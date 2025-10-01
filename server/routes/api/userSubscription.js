const express = require("express");
const router = express.Router();

const Plan = require("../../models/Plan");
const UserSubscription = require("../../models/UserSubscription");

const { StripeSecretKey, PublishableKey } = require("../../config");
const stripe = require("stripe")(StripeSecretKey);
let {
  OkResponse,
  BadRequestResponse,
  NotFoundResponse,
} = require("express-http-response");

let auth = require("../auth");
const Payment = require("../../models/Payment");
const { sendEmail } = require("../../utilities/nodemailer");
const endpointSecret =
  process.env.NODE_ENV === "development"
    ? "whsec_70bfca4fc516ecd14d064c547e65c02361014e7409eacc366b00b5631bcca9b6"
    : process.env.STRIPE_ENDPOINT_SECRET;

router.post(
  "/plan/:id/create-intent",
  auth.required,
  auth.patient,
  async (req, res, next) => {
    const planId = req.params.id;
    console.log("req.body coming in create intent", req.body);
    try {
      // const validCurrencies = ["mxn", "usd"];
      // if (!validCurrencies.includes(req.body.currency)) {
      //   return next(new BadRequestResponse("Invalid currency"));
      // }

      // Step 1: Find the plan
      const plan = await Plan.findById(planId);
      if (!plan) {
        return next(new NotFoundResponse("Plan not found"));
      }

      // Delete any existing pending subscription for this user and plan
      await UserSubscription.findOneAndDelete({
        userId: req.user._id,
        plan: planId,
        status: "pending",
      });

      // Check if the user already has an active subscription
      const existingSubscription = await UserSubscription.findOne({
        userId: req.user._id,
        status: "active",
      }).populate({
        path: "plan",
        match: { type: { $eq: "premium" } }, // Ensure the plan type is not free
      });

      if (
        existingSubscription &&
        existingSubscription?.plan?.type == "premium"
      ) {
        return next(
          new BadRequestResponse("You already have an active subscription.")
        );
      }

      console.log("existong subscription", existingSubscription);

      let customer;
      const existingUsers = await stripe.customers.list({
        email: req.user.email,
      });

      console.log("existingUsers*******************", existingUsers);

      if (existingUsers.data.length > 0) {
        // Find customer with matching currency
        // customer = existingUsers.data.find(
        //   (user) => user.metadata?.currency === req.body.currency
        // );
        customer = existingUsers.data[0];

        console.log("customer find after the currency match", customer);

        // If no customer with this currency exists, create one (but only if we have less than 2 customers)
        // if (!customer && existingUsers.data.length < 2) {
        //   customer = await stripe.customers.create({
        //     email: req.user.email,
        //     name: req.user?.fullName,
        //     metadata: {
        //       userId: req.user._id.toString(),
        //       currency: req.body.currency,
        //     },
        //   });
        //   console.log("customer created", customer);
        // }
      } else {
        // If no customers exist, create the first one
        customer = await stripe.customers.create({
          email: req.user.email,
          name: req.user?.fullName,
          metadata: {
            userId: req.user._id.toString(),
            currency: "usd",
          },
        });

        console.log("customer created", customer);
      }

      console.log("customer just before the subscription", customer);

      let subscription;

      // Create subscription with the system's price
      // if (req.body.currency === "mxn") {
      //   subscription = await stripe.subscriptions.create({
      //     customer: customer.id,
      //     items: [{ price: plan.stripePriceIds.mxn }],
      //     payment_behavior: "default_incomplete", // Set to incomplete until payment is confirmed
      //     expand: ["latest_invoice.payment_intent"], // Expand to get the payment intent for client_secret
      //     metadata: {
      //       userId: req.user._id.toString(),
      //       planId: planId.toString(),
      //       interval: "monthly",
      //     },
      //   });
      // } else {
      subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: plan.stripePriceIds.usd }],
        payment_behavior: "default_incomplete", // Set to incomplete until payment is confirmed
        expand: ["latest_invoice.payment_intent"], // Expand to get the payment intent for client_secret
        metadata: {
          userId: req.user._id.toString(),
          planId: planId.toString(),
          interval: "monthly",
        },
      });
      // }

      console.log("subscription", subscription);
      console.log("customer", customer);
      // Step 4: Create the user subscription record
      const newUserSubscription = new UserSubscription({
        userId: req.user._id,
        plan: planId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customer.id,
        status: "pending", // Initial status is "pending" until payment is confirmed
        renewalDate: new Date(subscription.current_period_end * 1000),
        lastPaymentDate: null, // To be updated after successful payment
        aiConsultationsLeft: plan.limits.aiConsultations,
        medicalReportsLeft: plan.limits.medicalReports,
        discount: plan.limits.bookingDiscount,
      });
      await newUserSubscription.save();

      // Step 5: Create the Payment record
      const transaction = new Payment({
        amount: plan.monthly.price.toFixed(2),
        payer: req.user._id,
        paymentMethod: "card", // Since this is Stripe, the payment method is card
        type: "subscription",
        status: "Initiated", // Status will be updated once payment is completed
        paymentId: subscription.latest_invoice.payment_intent.id,
        currency: "USD",
      });

      console.log("transaction coming in create intent", transaction);
      await transaction.save();

      // Step 6: Return the client_secret for payment confirmation
      return next(
        new OkResponse({
          clientSecret:
            subscription.latest_invoice.payment_intent.client_secret,
        })
      );
    } catch (error) {
      console.error("Error creating subscription:", error);
      return next(new BadRequestResponse(error.message));
    }
  }
);

// Create a subscription using your system's price (manage price in your system)
router.post(
  "/verify-intent/:id",
  auth.required,
  auth.patient,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const paymentIntent = await stripe.paymentIntents.retrieve(id);
      console.log("PaymentIntent:", paymentIntent);

      // Handle payment failure
      if (paymentIntent.status !== "succeeded") {
        const failureReason = paymentIntent.last_payment_error
          ? paymentIntent.last_payment_error.message
          : "Unknown error";
        return next(new BadRequestResponse(`Payment failed: ${failureReason}`));
      }

      if (paymentIntent.status === "succeeded") {
        const payment = await Payment.findOne({ paymentId: paymentIntent.id });

        if (!payment) {
          return next(new BadRequestResponse("Payment not found"));
        }

        payment.status = "Completed";
        await payment.save();

        const userSubscription = await UserSubscription.findOne({
          stripeSubscriptionId: paymentIntent.subscription,
        });
        const invoiceId = paymentIntent.invoice; // This is available in the paymentIntent
        const invoice = await stripe.invoices.retrieve(invoiceId);

        const subscriptionId = invoice.subscription;
        if (!subscriptionId) {
          return next(
            new BadRequestResponse("Subscription not found in invoice")
          );
        }

        // Step 4: Retrieve the subscription using the subscription ID
        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId
        );

        // Step 5: Extract metadata from the subscription (planId, userId, interval)
        const { planId, userId, interval } = subscription.metadata;
        if (!planId || !userId) {
          return next(
            new BadRequestResponse("Missing necessary subscription metadata")
          );
        }

        const existingSubscription = await UserSubscription.findOne({
          userId: req.user._id,
          status: "active",
        }).populate({
          path: "plan",
        });

        if (existingSubscription?.plan?.type == "free") {
          await UserSubscription.deleteOne({ _id: existingSubscription._id });
        }

        console.log(
          " *********** subscription id we get in the verify intent (*********",
          subscriptionId
        );

        const newUserSubscription = await UserSubscription.findOne({
          stripeSubscriptionId: subscriptionId,
        });

        if (newUserSubscription) {
          newUserSubscription.status = "active";
          newUserSubscription.lastPaymentDate = new Date(
            invoice.created * 1000
          ); // Convert Unix timestamp to Date
          await newUserSubscription.save();
          console.log(`Subscription ${subscriptionId} is now active.`);
        }

        const foundPlan = await Plan.findById(planId);
        if (!foundPlan) {
          return next(new NotFoundResponse("Plan not found"));
        }

        const userData = {
          patientName: req.user.fullName,
          plan: foundPlan,
          renewalDate: newUserSubscription.renewalDate,
          email: req.user.email,
        };

        console.log("user data", userData);

        await sendEmail(userData, "premium-subscription", {
          subscription: true,
        });

        // ✅ Final success response
        return next(
          new OkResponse({
            ...foundPlan.toObject(),
            subscriptionId: subscription.id,
          })
        );
      }
    } catch (error) {
      console.log("🔥 ~ error:", error);
      return next(new BadRequestResponse(error.message));
    }
  }
);

router.post(
  "/free/plan/:id",
  auth.required,
  auth.patient,
  async (req, res, next) => {
    try {
      const planId = req.params.id;

      const foundPlan = await Plan.findById(planId);

      // Step 3: Check if the user already has an active subscription
      const existingSubscription = await UserSubscription.findOne({
        userId: req.user._id,
        plan: planId,
        status: "active",
      });

      if (existingSubscription) {
        return next(
          new BadRequestResponse(
            "You already have an active subscription to this plan."
          )
        );
      }

      let customer;
      const existingUser = await stripe.customers.list({
        email: req.user.email,
      });

      if (existingUser.data.length > 0) {
        // If customer exists, use existing customer
        customer = existingUser.data[0];
      } else {
        // If no customer, create a new one
        customer = await stripe.customers.create({
          email: req.user.email,
          name: req.user?.fullName,
          metadata: { userId: req.user._id.toString() }, // Add user ID to metadata for reference
        });
      }

      // Create subscription with the system's price
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: foundPlan.monthly.price * 100, // Price in cents from your system
              recurring: { interval: "month" },
              product: foundPlan.stripeProductId, // The product ID in Stripe
            },
          },
        ],
        payment_behavior: "default_incomplete", // Set to incomplete until payment is confirmed
        expand: ["latest_invoice.payment_intent"], // Expand to get the payment intent for client_secret

        metadata: {
          userId: req.user._id.toString(),
          planId: planId.toString(),
          interval: "monthly",
        },
      });

      //Create a new subscription for freemium users
      const newUserSubscription = new UserSubscription({
        userId: req.user._id,
        plan: planId,
        status: "active",
        renewalDate: new Date(subscription.current_period_end * 1000),
        lastPaymentDate: new Date(subscription.latest_invoice.created * 1000),
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customer.id,
        aiConsultationsLeft: foundPlan.limits.aiConsultations,
        medicalReportsLeft: foundPlan.limits.medicalReports,
        discount: foundPlan.limits.bookingDiscount,
      });
      await newUserSubscription.save();

      const transaction = new Payment({
        amount: 0,
        payer: req.user._id,
        paymentMethod: "card",
        type: "subscription",
        status: "Completed",
        paymentId: null,
      });
      await transaction.save();

      return next(
        new OkResponse(req.t("pricing.messages.subscriptionActivated"))
      );
    } catch (err) {
      console.log("Error while subscribe to free", err);
      return next(new BadRequestResponse(err.message));
    }
  }
);

router.get("/usage", auth.required, auth.patient, async (req, res, next) => {
  try {
    const { usageType } = req.query;

    // Step 1: Find the most relevant subscription based on userId
    const subscription = await UserSubscription.findOne({
      userId: req.user._id,
      status: { $in: ["active"] }, // Include pending and inactive status
    }).populate("plan");

    if (!subscription) {
      return next(
        new BadRequestResponse(req.t("pricing.errors.noSubscription"))
      );
    }

    console.log(" **** user subscription ", subscription);

    // Step 2: Handle active subscription
    const now = new Date();
    if (now > new Date(subscription.renewalDate)) {
      // return next(
      //   new BadRequestResponse(
      //     "Your subscription has expired. Please renew your subscription."
      //   )

      // );

      return next(new BadRequestResponse(req.t("pricing.errors.expired")));
    } else {
      if (subscription?.plan?.type == "premium") {
        return next(new OkResponse(subscription)); // Access granted
      } else {
        if (usageType === "ai" && subscription.aiConsultationsLeft <= 0) {
          return next(
            new BadRequestResponse(req.t("pricing.errors.noAiConsultations"))
          );
        }

        if (usageType === "booking") {
          return next(new OkResponse(subscription)); // Access granted
        }

        if (usageType === "records" && subscription.medicalReportsLeft <= 0) {
          return next(
            new BadRequestResponse(req.t("pricing.errors.noMedicalRecord"))
          );
        }
      }

      return next(new OkResponse(subscription)); // Access granted
    }
  } catch (error) {
    return next(new BadRequestResponse(error.message));
  }
});

router.get("/status", auth.required, auth.patient, async (req, res, next) => {
  try {
    // Check if user already has an active subscription with a non-free plan
    const sub = await UserSubscription.findOne({
      userId: req.user.id,
      status: "active",
    }).populate({
      path: "plan",
      match: { type: { $ne: "free" } }, // Ensure the plan type is not free
    });

    console.log("User subscription:", sub);

    if (sub) {
      // If a subscription exists with a non-free plan, return that they already have a premium
      return next(
        new OkResponse({
          message: "You already have an active premium subscription.",
        })
      );
    }

    // If no active premium subscription is found, allow them to proceed with the purchase
    return next(new OkResponse({ active: false }));
  } catch (error) {
    return next(new BadRequestResponse("Unable to fetch status"));
  }
});

router.post(
  "/create-free",
  auth.required,
  auth.patient,
  async (req, res, next) => {
    try {
      // Check if user already has an active subscription
      const existingSubscription = await UserSubscription.findOne({
        userId: req.user._id,
        status: "active",
      }).populate("plan");

      if (existingSubscription) {
        return next(
          new BadRequestResponse("User already has an active subscription")
        );
      }

      if (existingSubscription && existingSubscription?.plan?.type == "free") {
        return next(
          new BadRequestResponse("User already has an active free subscription")
        );
      }
      if (
        existingSubscription &&
        existingSubscription?.plan?.type == "premium"
      ) {
        return next(
          new BadRequestResponse("User already has an active subscription")
        );
      }

      // Find the free plan
      const freePlan = await Plan.findOne({ type: "free" });
      if (!freePlan) {
        return next(new BadRequestResponse("Free plan not found"));
      }

      // Create new subscription with free plan
      const newUserSubscription = new UserSubscription({
        userId: req.user._id,
        plan: freePlan._id,
        status: "active",
        aiConsultationsLeft: freePlan.limits.aiConsultations,
        medicalReportsLeft: freePlan.limits.medicalReports,
        discount: freePlan.limits.bookingDiscount,
      });

      await newUserSubscription.save();

      return next(
        new OkResponse({
          message: "Free subscription created successfully",
          subscription: newUserSubscription,
        })
      );
    } catch (error) {
      console.error("Error creating free subscription:", error);
      return next(new BadRequestResponse(error.message));
    }
  }
);

router.post("/cancel", auth.required, auth.patient, async (req, res, next) => {
  try {
    const activeSub = await UserSubscription.findOne({
      userId: req.user._id,
    }).populate("plan");
    console.log("Active subsctiption", activeSub);

    if (!activeSub)
      return next(new BadRequestResponse("No active subscription"));
    if (activeSub && activeSub.plan.type === "free") {
      // Simply delete the freemium subscription document
      await activeSub.deleteOne();
      return next(new OkResponse("Subscription cancelled"));
    }

    // If no Stripe subscription ID, just delete the subscription document
    if (!activeSub.stripeSubscriptionId) {
      await activeSub.deleteOne();
      return next(
        new OkResponse("Subscription cancelled (no Stripe subscription found)")
      );
    }

    try {
      await stripe.subscriptions.del(activeSub.stripeSubscriptionId);
    } catch (stripeErr) {
      if (stripeErr.statusCode === 404) {
        // Subscription not found in Stripe, delete the subscription document anyway
        await activeSub.deleteOne();
        return next(
          new OkResponse(
            "Subscription cancelled (Stripe subscription not found)"
          )
        );
      }
      // For other errors, rethrow
      throw stripeErr;
    }

    // Delete the subscription document after successful Stripe cancellation
    await activeSub.deleteOne();
    return next(new OkResponse("Subscription cancelled"));
  } catch (err) {
    console.log("Error while canceling the subscription", err);
    return next(new BadRequestResponse(err.message));
  }
});

router.get("/details", auth.required, auth.patient, async (req, res, next) => {
  try {
    const subscription = await UserSubscription.findOne({
      userId: req.user._id,
      status: "active",
    }).populate("plan");
    if (!subscription)
      return next(new BadRequestResponse("No active subscription found"));

    return next(new OkResponse(subscription));
  } catch (err) {
    return next(new BadRequestResponse(err.message));
  }
});

router.post("/webhook", async (req, res) => {
  console.log("Request body coming", req.body);
  const sig = req.headers["stripe-signature"];

  let event;

  // Verify the webhook signature
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    console.log("event coming", event);
  } catch (err) {
    console.log(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the different event typesthe
  switch (event.type) {
    case "invoice.payment_succeeded":
      const invoice = event.data.object;

      console.log("invoice coming in success part", invoice);

      // Retrieve the subscription ID and update the subscription in your DB
      const subscriptionId = invoice.subscription;
      const paymentIntentId = invoice.payment_intent;

      // Find the subscription and update its status
      const subscription = await UserSubscription.findOne({
        stripeSubscriptionId: subscriptionId,
      });

      if (subscription) {
        subscription.status = "active";
        subscription.lastPaymentDate = new Date(invoice.created * 1000); // Convert Unix timestamp to Date
        await subscription.save();
        console.log(`Subscription ${subscriptionId} is now active.`);
      }

      // Optionally, handle the payment transaction if needed
      const payment = await Payment.findOne({ paymentId: paymentIntentId });
      if (payment) {
        payment.status = "Completed";
        await payment.save();
      }

      break;

    case "invoice.payment_failed":
      const failedInvoice = event.data.object; // Contains an invoice object

      console.log("failed invoice coming in success part", failedInvoice);
      try {
        // Find the subscription and update its status to 'inactive'
        const subscriptionId = failedInvoice.subscription;
        const subscription = await UserSubscription.findOne({
          stripeSubscriptionId: subscriptionId,
        });

        if (subscription) {
          subscription.status = "inactive";
          await subscription.save();
          console.log(
            `Subscription ${subscriptionId} is now inactive due to failed payment.`
          );
        }

        const failedPayment = new Payment({
          amount: failedInvoice.amount_due / 100, // Convert to dollars
          payer: userId,
          paymentMethod: "card", // Could be different depending on your setup
          type: "subscription",
          status: "Failed",
        });
        await failedPayment.save();

        return res
          .status(200)
          .send("Invoice payment failed, user subscription updated.");
      } catch (error) {
        console.log("Error handling failed invoice payment:", error);
        return res.status(500).send("Internal Server Error");
      }
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
      return res.status(200).send("Event type not handled.");
  }
});

module.exports = router;
