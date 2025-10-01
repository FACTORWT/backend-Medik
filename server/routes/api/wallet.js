let router = require("express").Router();
let { OkResponse, BadRequestResponse } = require("express-http-response");
let mongoose = require("mongoose");
const auth = require("../auth");
const Wallet = mongoose.model("Wallet");
const Payment = mongoose.model("Payment");
var queryString = require("querystring");
var request = require("request");
const { emitEvent } = require("../../utilities/realTime");

const { sendNotification } = require("../../utilities/notification");
// const { StripeClientId } = require("../../config/common");
const { StripeSecretKey, StripeClientId } = require("../../config/common");


const stripe = require("stripe")(StripeSecretKey);

router.get("/", auth.required, auth.user, async (req, res, next) => {
	return next(new OkResponse(req.user.wallet));
});

router.get("/stripe", async (req, res, next) => {
	let data =
		"https://connect.stripe.com/oauth/authorize" +
		"?" +
		queryString.stringify({
			response_type: "code",
			scope: "read_write",
			client_id: StripeClientId,
		});

	return next(new OkResponse(data));
});

router.get("/stripe/callback", auth.required, auth.user, async (req, res, next) => {
	try {
		var authCode = req.query.code;

		request.post(
			{
				url: "https://connect.stripe.com/oauth/token",
				form: {
					grant_type: "authorization_code",
					client_id: StripeClientId,
					code: authCode,
					client_secret: StripeSecretKey,
				},
			},

			async function (err, response, body) {
				if (req.user.wallet.stripeAccountId == "") {
					var stripeUserID = JSON.parse(body).stripe_user_id;
					req.user.wallet.stripeAccountId = stripeUserID;

					await req.user.save();
					const newWallet = await req.user.wallet.save();

					await sendNotification(
						"Stripe Connection",
						`Hello ${req.user.fullName}, you are successfully connected with the stripe `,
						`Hola ${req.user.fullName}, te has conectado exitosamente con Stripe.`,
						req.user._id,
						req.user._id,
						req.user.wallet,
						{ wallet: req.user.wallet }
					);

					emitEvent(`updated-wallet-for-${req.user.wallet._id}`, {
						wallet: newWallet,
					});

					return next(new OkResponse(req.user.wallet));
				}
			}
		);
	} catch (error) {
		return next(new BadRequestResponse(req.t("wallet.errors.stripeError")));
	}
});


router.post("/withdraw/all-amount", auth.required, auth.user, async (req, res, next) => {
  try {
    if (!!!req.body) return next(new BadRequestResponse(req.t("wallet.errors.missingRequiredParameter"), 422.0));

    const { amount } = req.body;
    if (!req.user.wallet.stripeAccountId)
      return next(new BadRequestResponse(req.t("wallet.errors.stripeAccountNotConnected")));

    if (amount > req.user.wallet.currentBalance) {
      return next(new BadRequestResponse(req.t("wallet.errors.insufficientBalance")));
    }

    const totalWithdrawAmount = req.user.wallet.currentBalance - req.user.wallet.payableAmount ?? 0;
    const totalDeductedAmount = req.user.wallet.currentBalance - totalWithdrawAmount;

    // Handle withdrawal if there is available balance
    if (totalWithdrawAmount > 0) {
      await stripe.transfers.create({
        amount: totalWithdrawAmount * 100,
        currency: "usd",
        destination: req.user.wallet.stripeAccountId,
        transfer_group: "AI-Medik",
      });

      const allTransactions = await Payment.find({ payee: req.user._id });
      if (!allTransactions) return next(new BadRequestResponse(req.t("wallet.errors.paymentNotFound")));

      await Payment.updateMany({ payee: req.user._id }, { $set: { withDraw: true } });

      // Deduct the total withdraw amount from the balance
			let totalAmountCut = totalWithdrawAmount + totalDeductedAmount;
      req.user.wallet.currentBalance -= totalAmountCut;
      req.user.wallet.totalEarnings += totalWithdrawAmount;

      req.user.wallet.payableAmount = Math.max(0, req.user.wallet.payableAmount - totalDeductedAmount);

      await req.user.wallet.save();
			return next(new OkResponse(req.user.wallet))

    } else {
      // If no withdrawable amount, handle appropriately
      const allTransactions = await Payment.find({ payee: req.user._id });
      if (!allTransactions) return next(new BadRequestResponse(req.t("wallet.errors.paymentNotFound")));

      await Payment.updateMany({ payee: req.user._id }, { $set: { withDraw: true } });

      // Handle case with no funds to withdraw
      req.user.wallet.currentBalance -= 0; // No withdrawal made
      req.user.wallet.payableAmount -= totalDeductedAmount;


      await req.user.wallet.save();
			return next(new OkResponse(req.user.wallet))
			
		}
    
  } catch (error) {
    return next(new BadRequestResponse(req.t("wallet.errors.stripeError")));
  }
});


module.exports = router;
