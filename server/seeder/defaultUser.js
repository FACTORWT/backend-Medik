const User = require("../models/User");
const Wallet = require("../models/Wallet");

const defaultUsers = async () => {
	// Seed Admin
	{
		let admin = new User();
		admin.role = "admin";
		admin.email = "Admin@ai-medik.com";
		admin.setPassword("Aimedik2024??");
		admin.isEmailVerified = true;
		admin.status = "active";
		admin.phone = "12345678923";

		await admin.save();
	}
	// user
	{
		let user = new User();
		user.email = "patient@gmail.com";
		user.fullName = "Patient";
		user.setPassword("1234");
		user.isEmailVerified = true;
		user.status = "active";
		user.birthDate = "1998-02-25";
		user.phone = "123456789";

		let wallet = new Wallet();
		await wallet.save();
		user.wallet = wallet._id;

		await user.save();
	}
	{
		let user = new User();
		user.email = "doctor@gmail.com";
		user.setPassword("1234");
		user.role = "doctor";
		user.isEmailVerified = true;
		user.status = "active";
		user.profileCompletionStatus = 4;
		user.fullName = "Doctor";
		user.phone="+9230245363"
		

		user.about = "I have specialized in Allergist Field with having plenty of experience";
		user.fee = "45";
		user.experience = "8";


		let wallet = new Wallet();
		await wallet.save();
		user.wallet = wallet._id;

		await user.save();
	}
	console.log("Default Users Seeded");
};

module.exports = defaultUsers;
