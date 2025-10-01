let mongoose = require("mongoose");
let router = require("express").Router();
let Contact = mongoose.model("Contact");
let { OkResponse, BadRequestResponse } = require("express-http-response");
const auth = require("../auth");

router.post("/", async (req, res, next) => {
	try {
		if (!req.body.name || !req.body.email || !req.body.message) {
			return next(new BadRequestResponse(req.t("contact.errors.allFieldsRequired")));
		}

		let contact = new Contact();
		contact.userName = req.body.name;
		contact.email = req.body.email;
		contact.message = req.body.message;

		await contact.save();

		return next(new OkResponse({}, req.t("contact.messages.formSubmitted")));
	} catch (error) {
		return next(new BadRequestResponse(error.message));
	}
});

router.get("/", auth.required, auth.admin, async (req, res, next) => {
	try {
		const page = parseInt(req.query.page) || 1; // Ensure page is a number
		const limit = parseInt(req.query.limit) || 10; // Ensure limit is a number
		const skip = (page - 1) * limit;

		// Fetch paginated data
		const userForms = await Contact.find().skip(skip).limit(limit).sort({ createdAt: -1 });

		// Get total count for pagination
		const totalCount = await Contact.countDocuments();

		return next(
			new OkResponse({
				data: userForms,
				total: totalCount,
				page,
				limit,
			})
		);
	} catch (error) {
		return next(new BadRequestResponse(error.message));
	}
});

module.exports = router;
