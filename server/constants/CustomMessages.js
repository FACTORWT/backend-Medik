exports.ErrorMessages = {
	userBlocked: "You're blocked by admin! Contact to site admin!!",
	userUnverified: "Your email is not verified yet! Please verify your email and try again!!!",

	userAlreadyRegisteredWithProfile: "You’re already registered with Email & Password!",
	userAlreadyRegisteredWithGoogle: "You’re already registered with google!!",
	userAlreadyRegisteredWithLinkedIn: "You’re already registered with linkedIn!!",
	userAlreadyRegisteredWithSocialLogin: "You’re already registered with linkedIn!!",

	userNotFound: "No account is associated with this email!!",
	emailNotFound: "we didn't get any linked email address from your account",

	generalMessage: "Oops! something went wrong",
	invalidCredentials: "Username or password is invalid!!",
};

exports.SuccessMessages = {
	generalMessage: "Success!",
	operationSuccess: "The operation was completed successfully",
};


exports.OTPMessage = (otp) =>
	`<#> Your requested OTP code is ${otp} valid for 30 mins. Never share this code with anyone. AiMedic will never call you to ask for this code. QQD4P/VfoBc`;

