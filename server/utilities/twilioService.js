const twilio = require('twilio');
const { TwilioAccountSid, TwilioAuthToken, TwilioVerifyServiceSid, TwilioPhoneNumber } = require('../config');

// Initialize Twilio client with environment variables
const accountSid = TwilioAccountSid
const authToken = TwilioAuthToken;
const verifyServiceSid = TwilioVerifyServiceSid;
const twilioPhoneNumber = TwilioPhoneNumber;

// Validate required environment variables
if (!accountSid || !authToken) {
    throw new Error('Twilio credentials are missing. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.');
}

// Initialize Twilio client
const client = twilio(accountSid, authToken);

class TwilioService {
    /**
     * Send OTP using Twilio Messages API
     * @param {string} phoneNumber - The phone number to send OTP to
     * @param {string} otp - The OTP code to send
     * @returns {Promise} - Returns the message status
     */
    static async sendOTP(phoneNumber, otp) {
        try {
            if (!twilioPhoneNumber) {
                throw new Error('TWILIO_PHONE_NUMBER environment variable is not set');
            }

            const message = `Your AI-Medik verification code is: ${otp}`;
            const messageResponse = await client.messages.create({
                body: message,
                from: twilioPhoneNumber,
                to: phoneNumber
            });
            
            return {
                success: true,
                status: messageResponse.status,
                sid: messageResponse.sid
            };
        } catch (error) {
            console.error('Error sending OTP:', error);
            throw error;
        }
    }


    /**
     * Send custom SMS message using Twilio Messages API
     * @param {string} phoneNumber - The phone number to send message to
     * @param {string} message - The message content
     * @returns {Promise} - Returns the message status
     */
    static async sendMessage(phoneNumber, message) {
        try {
            if (!twilioPhoneNumber) {
                throw new Error('TWILIO_PHONE_NUMBER environment variable is not set');
            }

            const messageResponse = await client.messages.create({
                body: message,
                from: twilioPhoneNumber,
                to: phoneNumber
            });
            
            return {
                success: true,
                status: messageResponse.status,
                sid: messageResponse.sid
            };
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    /**
     * Send meeting reminder message
     * @param {string} phoneNumber - The phone number to send reminder to
     * @param {Object} meetingDetails - Meeting details object
     * @returns {Promise} - Returns the message status
     */
    static async sendMeetingReminder(phoneNumber, meetingDetails) {
        const message = `Reminder: ${meetingDetails.title} is scheduled to start in ${meetingDetails.timeUntilStart}. 
Date: ${meetingDetails.date}
Time: ${meetingDetails.startTime}`;

        return this.sendMessage(phoneNumber, message);
    }
}

module.exports = TwilioService; 