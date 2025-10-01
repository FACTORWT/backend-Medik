const { footer, header } = require("./layout");
const { publicPics } = require("../config");

exports.emailVerifyTemplate = (user) => {
	return `
    <!DOCTYPE html>
    <html lang="en">
    ${header}
    <body>
        <div style="font-family: Arial, Helvetica, sans-serif; background-color: #F0F3F7;width: 638px; padding: 24px; margin: 0 auto;">
            <div style="width: 150px; height: 60px; margin: 0 auto;margin-bottom: 20px;">
                <img src="${publicPics}/logo-light.png" alt=""
                    style="width:100%; height:100%; object-fit:contain;">
            </div>
            <div style="background-color: #F8F9FB;border-radius: 24px; padding: 30px 55px;">
                <h1
                    style="font-style: normal;font-weight: 400;font-size: 24px;color: #313D5B;text-align: center; letter-spacing: 0.02em;">
                    Welcome to AI MediK
                </h1>
                <h3 style="text-align: center;">Your Verification code:</h3>
                <div style="text-align: center;">
                    <h3
                        style="color: #00bfff ; text-align: center; display:inline-block; padding: 20px 40px; border-radius: 12px; background: #fff; font-style: normal;font-weight: 900;font-size: 38px;text-align: left; letter-spacing: 22px; box-shadow: rgba(50, 50, 93, 0.25) 0px 30px 60px -12px inset, rgba(0, 0, 0, 0.3) 0px 18px 36px -18px inset;">
                        ${user.otp}
                    </h3>
                </div>
                <p
                    style="text-align:center; font-weight: 400;font-size: 16px; color: #313D5B;line-height: 26px;max-width: 350px;margin: 0 auto;">
                    This verification code will
                    be valid for 30 minutes. please do not share with anyone
                </p>
            </div>
        </div>
    </body>

    </html>`;
};




exports.forgetEmailTemplate = (user) => {
	return `
    <!DOCTYPE html>
    <html lang="en">
    ${header}
    <body>
        <div style="font-family: Arial, Helvetica, sans-serif; background-color: #F0F3F7;width: 638px; padding: 24px; margin: 0 auto;">
            <div style="width: 150px; height: 60px; margin: 0 auto;margin-bottom: 20px;">
                <img src="${publicPics}/logo-light.png" alt=""
                    style="width:100%; height:100%; object-fit:contain;">
            </div>
            <div style="background-color: #F8F9FB;border-radius: 24px; padding: 30px 55px;">
                <h1
                    style="font-style: normal;font-weight: 400;font-size: 24px;color: #313D5B;text-align: center; letter-spacing: 0.02em;">
                   You recently requested to reset your password for your Business account.
                </h1>
                <h3 style="text-align: center;">Your Verification code:</h3>
                <div style="text-align: center;">
                    <h3
                        style="color: #00bfff ; text-align: center; display:inline-block; padding: 20px 40px; border-radius: 12px; background: #fff; font-style: normal;font-weight: 900;font-size: 38px;text-align: left; letter-spacing: 22px; box-shadow: rgba(50, 50, 93, 0.25) 0px 30px 60px -12px inset, rgba(0, 0, 0, 0.3) 0px 18px 36px -18px inset;">
                        ${user.otp}
                    </h3>
                </div>
                <p
                    style="text-align:center; font-weight: 400;font-size: 16px; color: #313D5B;line-height: 26px;max-width: 350px;margin: 0 auto;">
                    If you did not request to reset your password, please ignore this mail. This password reset request is
                    only valid for the next 30 minutes.
                </p>
            </div>
        </div>
    </body>

    </html>`;
};

exports.profileRejectionTemplate = (user) => {
	return `
    <!DOCTYPE html>
    <html lang="en">
    ${head}
    <body>
    <div
    style="font-family: Arial, Helvetica, sans-serif; background-color: #F0F3F7;width: 638px;padding: 24px; margin: 0 auto;">
        <div style="width: 150px; height: 60px; margin: 0 auto;">
            <img src="${publicPics}/logo-light.png" alt="" style="width:100%; height:100%; object-fit:contain;">
        </div>
        <div style="background-color: #F8F9FB;border-radius: 24px; padding: 30px 55px;">
            <h1
                style="font-style: normal;font-weight: 400;font-size: 24px;color: #313D5B;text-align: center; letter-spacing: 0.02em;">
                Account Alert!
            </h1>
            <div
                style="background-color: white; box-shadow: rgba(99, 99, 99, 0.2) 0px 2px 8px 0px;border-radius: 32px;width: 208px;height: 208px; margin:auto; padding:36px; box-sizing: border-box;">
                <img src="${publicPics}/blockIcon.png" alt="">
            </div>
            <p style="text-align:center; font-weight: 400;font-size: 16px; color: #313D5B;">Your Account approval is rejected by admin.</p>

            <div style="text-align: center; margin-top: 20px;">
                <a href="javascript:void(0)"
                    style="text-decoration: none; font-size: 13px;font-weight: 400;letter-spacing: 0.02em;color: #2da44e;">View
                    in browser</a>
            </div>
        </div>
        ${footer}
    </div>
    </body>

    </html>`;
};

exports.profileActiveTemplate = (user) => {
	return `
    <!DOCTYPE html>
    <html lang="en">
    ${head}
    <body>
       <div
        style="font-family: Arial, Helvetica, sans-serif; background-color: #F0F3F7;width: 638px;padding: 24px; margin: 0 auto;">
            <div style="width: 150px; height: 60px; margin: 0 auto;">
                <img src="${publicPics}/logo-light.png" alt="" style="width:100%; height:100%; object-fit:contain;">
            </div>
            <div style="background-color: #F8F9FB;border-radius: 24px; padding: 30px 55px;">
                <h1
                    style="font-style: normal;font-weight: 400;font-size: 24px;color: #313D5B;text-align: center; letter-spacing: 0.02em;">
                   Account Alert!
                </h1>
                <div
                    style="background-color: white; box-shadow: rgba(99, 99, 99, 0.2) 0px 2px 8px 0px;border-radius: 32px;width: 208px;height: 208px; margin:auto; padding:10px ">
                    <img src="${publicPics}/Icons-bid.png" style="margin:63px;" alt="">
                </div>
                <p style="text-align:center; font-weight: 400;font-size: 16px; color: #313D5B;">Your Account is activated by admin</p>
               
                <div style="text-align: center; margin-top: 20px;">
                <a href="javascript:void(0)"
                    style="text-decoration: none; font-size: 13px;font-weight: 400;letter-spacing: 0.02em;color: #2da44e;">View
                    in browser</a>
            </div>
            </div>
            ${footer}
        </div>
    </body>

    </html>`;
};

exports.profileBlockTemplate = (user) => {
	return `
    <!DOCTYPE html>
    <html lang="en">
    ${head}
    <body>
       <div
        style="font-family: Arial, Helvetica, sans-serif; background-color: #F0F3F7;width: 638px;padding: 24px; margin: 0 auto;">
            <div style="width: 150px; height: 60px; margin: 0 auto;">
                <img src="${publicPics}/logo-light.png" alt="" style="width:100%; height:100%; object-fit:contain;">
            </div>
            <div style="background-color: #F8F9FB;border-radius: 24px; padding: 30px 55px;">
                <h1
                    style="font-style: normal;font-weight: 400;font-size: 24px;color: #313D5B;text-align: center; letter-spacing: 0.02em;">
                    Account Alert!
                </h1>
                <div
                    style="background-color: white; box-shadow: rgba(99, 99, 99, 0.2) 0px 2px 8px 0px;border-radius: 32px;width: 208px;height: 208px; margin:auto; padding:36px; box-sizing: border-box;">
                    <img src="${publicPics}/blockIcon.png" alt="">
                </div>
                <p style="text-align:center; font-weight: 400;font-size: 16px; color: #313D5B;">
                    Your Account is blocked by admin.
                </p>
                <div style="text-align: center; margin-top: 20px;">
                <a href="javascript:void(0)"
                    style="text-decoration: none; font-size: 13px;font-weight: 400;letter-spacing: 0.02em;color: #2da44e;">View
                    in browser</a>
            </div>
            </div>
            ${footer}
        </div>
    </body>

    </html>`;
};

exports.profileDeletedTemplate = (user) => {
	return `
    <!DOCTYPE html>
    <html lang="en">
    ${head}
    <body>
        <div
            style="font-family: Arial, Helvetica, sans-serif; background-color: #F0F3F7;width: 638px;padding: 24px; margin: 0 auto;">
            <div style="width: 150px; height: 60px; margin: 0 auto;">
                <img src="${publicPics}/logo.png" alt="" style="width:100%; height:100%; object-fit:contain;">
            </div>
            <div style="background-color: #F8F9FB;border-radius: 24px; padding: 30px 55px;">
                <h1
                    style="font-style: normal;font-weight: 400;font-size: 24px;color: #313D5B;text-align: center; letter-spacing: 0.02em;">
                    Account Alert!
                </h1>
                <div
                    style="background-color: white; box-shadow: rgba(99, 99, 99, 0.2) 0px 2px 8px 0px;border-radius: 32px;width: 208px;height: 208px; margin:auto; padding:36px; box-sizing: border-box; ">
                    <img src="${publicPics}/blockIcon.png" alt="">
                </div>
                <p style="text-align:center; font-weight: 400;font-size: 16px; color: #313D5B;">Your Account is deleted by admin</p>
                <div style="text-align: center; margin-top: 20px;">
                <a href="javascript:void(0)"
                    style="text-decoration: none; font-size: 13px;font-weight: 400;letter-spacing: 0.02em;color: #2da44e;">View
                    in browser</a>
            </div>
            </div>
            ${footer}
        </div>
    </body>

    </html>`;
};

exports.meetingEmailPatientTemplate = (user) => {
    console.log("user from meeting email patient template *********",user)
	return `
 <!DOCTYPE html>
<html lang="en">
<body>
    <div style="font-family: Arial, Helvetica, sans-serif; background-color: #F0F3F7; width: 638px; padding: 24px; margin: 0 auto;">
        <div style="width: 150px; height: 60px; margin: 0 auto; margin-bottom: 20px;">
            <img src="${publicPics}/logo-light.png" alt="" style="width:100%; height:100%; object-fit:contain;">
        </div>
        
        <div style="padding: 30px; border-radius: 20px; background-color: #F8F9FB;">
            <div>
                <h2 style="color: #00ccbe;">English </h2>
                
                <div style="margin-bottom: 20px; font-weight: 700;">
                    Dear 
                    <span style="font-weight:700; color: #00ccbe; text-transform:uppercase">${user.patientName}</span>
                </div>
                
                <div style="line-height: 1.4;">
                    We wanted to remind you that your appointment with 
                    <span style="color: #00ccbe">${user.doctorName}</span> is scheduled on 
                    ${new Date(user.patientMeetingTime).toLocaleString('en-US', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true
                    })}
                    .
                </div>
                
                <p>We look forward to seeing you!</p>
                
                <div style="margin-bottom:10px;">To join the meeting, please click here:</div>
                
                <a href="${user.meetingLink}" style="text-decoration: none;">
                    <button style="display: inline-block; padding: 10px 20px; background-color: #00ccbe; color: #ffffff; border: none; border-radius: 5px; cursor: pointer;">
                        Join Meeting
                    </button>
                </a>

                <div style="margin-top: 10px;">Please be careful about following instructions:</div>

                <ul>
                    <li style="margin-top: 10px;">Be on time</li>
                    <li style="margin-top: 10px;">Setup your space with optimal lighting</li>
                    <li style="margin-top: 10px;">Ensure that your microphone and camera work properly</li>
                </ul>

                <p>Kind regards,</p>
                <p style="color: #00ccbe; font-weight: 600;">AI Medik</p>
            </div>
            
            <div style="border-top: 2px solid #00ccbe; margin: 20px 0;"></div>
            
            <div>

                 <h2 style="color: #00ccbe;"> Español </h2>
                <div style="margin-bottom: 20px; font-weight: 700;">
                    Estimado(a) 
                    <span style="font-weight:700; color: #00ccbe; text-transform:uppercase">${user.patientName}</span>
                </div>
                
                <div style="line-height: 1.4;">
                    Queríamos recordarle que su cita con 
                    <span style="color: #00ccbe">${user.doctorName}</span> está programada para el 
                    ${new Date(user.patientMeetingTime).toLocaleString('es-ES', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true
                    })}
                    .
                </div>
                
                <p>¡Esperamos verle pronto!</p>
                
                <div style="margin-bottom:10px;">Para unirse a la reunión, haga clic aquí:</div>
                
                <a href="${user.meetingLink}" style="text-decoration: none;">
                    <button style="display: inline-block; padding: 10px 20px; background-color: #00ccbe; color: #ffffff; border: none; border-radius: 5px; cursor: pointer;">
                        Unirse a la Reunión
                    </button>
                </a>

                <div style="margin-top: 10px;">Por favor, tenga en cuenta las siguientes instrucciones:</div>

                <ul>
                    <li style="margin-top: 10px;">Llegue a tiempo</li>
                    <li style="margin-top: 10px;">Prepare su espacio con iluminación óptima</li>
                    <li style="margin-top: 10px;">Asegúrese de que su micrófono y cámara funcionen correctamente</li>
                </ul>

                <p>Cordiales saludos,</p>
                <p style="color: #00ccbe; font-weight: 600;">AI Medik</p>
            </div>
        </div>
    </div>
</body>
</html>`;
};

exports.meetingEmailPatientTemplateOnSite = (user) => {
    console.log("user from meeting email patient template on site *********",user)
	return `
 <!DOCTYPE html>
<html lang="en">
<body>
    <div style="font-family: Arial, Helvetica, sans-serif; background-color: #F0F3F7; width: 638px; padding: 24px; margin: 0 auto;">
        <div style="width: 150px; height: 60px; margin: 0 auto; margin-bottom: 20px;">
            <img src="${publicPics}/logo-light.png" alt="" style="width:100%; height:100%; object-fit:contain;">
        </div>
        
        <div style="padding: 30px; border-radius: 20px; background-color: #F8F9FB;">
            <div>
                <h2 style="color: #00ccbe;">English </h2>
                
                <div style="margin-bottom: 20px; font-weight: 700;">
                    Dear 
                    <span style="font-weight:700; color: #00ccbe; text-transform:uppercase">${user.patientName}</span>
                </div>
                
                <div style="line-height: 1.4;">
                    We wanted to remind you that your onsite appointment with 
                    <span style="color: #00ccbe">${user.doctorName}</span> is scheduled on 
                    ${new Date(user.patientMeetingTime).toLocaleString('en-US', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true
                    })}
                    .
                </div>
                
                <p>We look forward to seeing you!</p>
                
            

                <p>Kind regards,</p>
                <p style="color: #00ccbe; font-weight: 600;">AI Medik</p>
            </div>
            
            <div style="border-top: 2px solid #00ccbe; margin: 20px 0;"></div>
            
            <div>

                 <h2 style="color: #00ccbe;"> Español </h2>
                <div style="margin-bottom: 20px; font-weight: 700;">
                    Estimado(a) 
                    <span style="font-weight:700; color: #00ccbe; text-transform:uppercase">${user.patientName}</span>
                </div>
                
                <div style="line-height: 1.4;">
                   Queríamos recordarle que su cita in situ con 
                    <span style="color: #00ccbe">${user.doctorName}</span> está programada para el 
                    ${new Date(user.patientMeetingTime).toLocaleString('es-ES', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true
                    })}
                    .
                </div>
                
                <p>¡Esperamos verle pronto!</p>
                
               
                
            
              

                <p>Cordiales saludos,</p>
                <p style="color: #00ccbe; font-weight: 600;">AI Medik</p>
            </div>
        </div>
    </div>
</body>
</html>`;
};

exports.meetingEmailDoctorTemplateOnSite = (user) => {
	return `
 <!DOCTYPE html>
<html lang="en">
<body>
    <div style="font-family: Arial, Helvetica, sans-serif; background-color: #F0F3F7; width: 638px; padding: 24px; margin: 0 auto;">
        <div style="width: 150px; height: 60px; margin: 0 auto; margin-bottom: 20px;">
            <img src="${publicPics}/logo-light.png" alt="" style="width:100%; height:100%; object-fit:contain;">
        </div>
        
        <div style="padding: 30px; border-radius: 20px; background-color: #F8F9FB;">
            <div>
                <h2 style="color: #00ccbe;">English </h2>
                
                <div style="margin-bottom: 20px; font-weight: 700;">
                    Dear 
                    <span style="font-weight:700; color: #00ccbe; text-transform:uppercase">${user.doctorName}</span>
                </div>
                
                <div style="line-height: 1.4;">
                    We wanted to remind you that your onsite appointment with 
                    <span style="color: #00ccbe">${user.patientName}</span> is scheduled on 
                    ${new Date(user.doctorMeetingTime).toLocaleString('en-US', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true
                    })}
                    .
                </div>
                
                <p>We look forward to seeing you!</p>
                
              
                
               

              

         

                <p>Kind regards,</p>
                <p style="color: #00ccbe; font-weight: 600;">AI Medik</p>
            </div>
            
            <div style="border-top: 2px solid #00ccbe; margin: 20px 0;"></div>
            
            <div>

                 <h2 style="color: #00ccbe;"> Español </h2>
                <div style="margin-bottom: 20px; font-weight: 700;">
                    Estimado(a) 
                    <span style="font-weight:700; color: #00ccbe; text-transform:uppercase">${user.doctorName}</span>
                </div>
                
                <div style="line-height: 1.4;">
                   Queríamos recordarle que su cita in situ con 
                    <span style="color: #00ccbe">${user.patientName}</span> está programada para el 
                    ${new Date(user.doctorMeetingTime).toLocaleString('es-ES', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true
                    })}
                    .
                </div>
                
                <p>¡Esperamos verle pronto!</p>
                
              
                
            
              

                <p>Cordiales saludos,</p>
                <p style="color: #00ccbe; font-weight: 600;">AI Medik</p>
            </div>
        </div>
    </div>
</body>
</html>`;
};

exports.meetingEmailDoctorTemplate = (user) => {
	return `
    
 <!DOCTYPE html>
<html lang="en">
<body>
    <div style="font-family: Arial, Helvetica, sans-serif; background-color: #F0F3F7; width: 638px; padding: 24px; margin: 0 auto;">
        <div style="width: 150px; height: 60px; margin: 0 auto; margin-bottom: 20px;">
            <img src="${publicPics}/logo-light.png" alt="" style="width:100%; height:100%; object-fit:contain;">
        </div>
        
        <div style="padding: 30px; border-radius: 20px; background-color: #F8F9FB;">
            <div>
                <h2 style="color: #00ccbe;">English </h2>
                
                <div style="margin-bottom: 20px; font-weight: 700;">
                    Dear 
                    <span style="font-weight:700; color: #00ccbe; text-transform:uppercase">${user.doctorName}</span>
                </div>
                
                <div style="line-height: 1.4;">
                    We wanted to remind you that your appointment with 
                    <span style="color: #00ccbe">${user.patientName}</span> is scheduled on 
                    ${new Date(user.doctorMeetingTime).toLocaleString('en-US', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true
                    })}
                    .
                </div>
                
                <p>We look forward to seeing you!</p>
                
                <div style="margin-bottom:10px;">To join the meeting, please click here:</div>
                
                <a href="${user.meetingLink}" style="text-decoration: none;">
                    <button style="display: inline-block; padding: 10px 20px; background-color: #00ccbe; color: #ffffff; border: none; border-radius: 5px; cursor: pointer;">
                        Join Meeting
                    </button>
                </a>

                <div style="margin-top: 10px;">Please be careful about following instructions:</div>

                <ul>
                    <li style="margin-top: 10px;">Be on time</li>
                    <li style="margin-top: 10px;">Setup your space with optimal lighting</li>
                    <li style="margin-top: 10px;">Ensure that your microphone and camera work properly</li>
                </ul>

                <p>Kind regards,</p>
                <p style="color: #00ccbe; font-weight: 600;">AI Medik</p>
            </div>
            
            <div style="border-top: 2px solid #00ccbe; margin: 20px 0;"></div>
            
            <div>

                 <h2 style="color: #00ccbe;"> Español </h2>
                <div style="margin-bottom: 20px; font-weight: 700;">
                    Estimado(a) 
                    <span style="font-weight:700; color: #00ccbe; text-transform:uppercase">${user.doctorName}</span>
                </div>
                
                <div style="line-height: 1.4;">
                    Queríamos recordarle que su cita con 
                    <span style="color: #00ccbe">${user.patientName}</span> está programada para el 
                        ${new Date(user.doctorMeetingTime).toLocaleString('es-ES', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true
                    })}
                    .
                </div>
                
                <p>¡Esperamos verle pronto!</p>
                
                <div style="margin-bottom:10px;">Para unirse a la reunión, haga clic aquí:</div>
                
                <a href="${user.meetingLink}" style="text-decoration: none;">
                    <button style="display: inline-block; padding: 10px 20px; background-color: #00ccbe; color: #ffffff; border: none; border-radius: 5px; cursor: pointer;">
                        Unirse a la Reunión
                    </button>
                </a>

                <div style="margin-top: 10px;">Por favor, tenga en cuenta las siguientes instrucciones:</div>

                <ul>
                    <li style="margin-top: 10px;">Llegue a tiempo</li>
                    <li style="margin-top: 10px;">Prepare su espacio con iluminación óptima</li>
                    <li style="margin-top: 10px;">Asegúrese de que su micrófono y cámara funcionen correctamente</li>
                </ul>

                <p>Cordiales saludos,</p>
                <p style="color: #00ccbe; font-weight: 600;">AI Medik</p>
            </div>
        </div>
    </div>
</body>
</html>`;
};

exports.premiumSubscriptionTemplate = (user) => {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <body>
      <div style="font-family: Arial, Helvetica, sans-serif; background-color: #F0F3F7; width: 638px; padding: 24px; margin: 0 auto;">
        <div style="width: 150px; height: 60px; margin: 0 auto; margin-bottom: 20px;">
          <img src="${publicPics}/logo-light.png" alt="" style="width:100%; height:100%; object-fit:contain;">
        </div>
        
        <div style="padding: 30px; border-radius: 20px; background-color: #F8F9FB;">
          <!-- English Version -->
          <div>
            <h2 style="color: #00ccbe;">Premium Subscription Confirmation</h2>
            
            <div style="margin-bottom: 20px; font-weight: 700;">
              Dear <span style="font-weight:700; color: #00ccbe; text-transform:uppercase">${user.patientName}</span>
            </div>
            
            <div style="line-height: 1.4;">
              Thank you for subscribing to our Premium Plan! Your subscription has been successfully activated.
            </div>
  
            <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #00ccbe;">
              <h3 style="color: #00ccbe; margin-top: 0;">Your Premium Benefits Include:</h3>
              <ul style="list-style: none; padding: 0;">
                <li style="margin: 10px 0; display: flex; align-items: center;">
                  <span style="color: #00ccbe; margin-right: 10px;">✓</span>
                  Unlimited AI Consultations
                </li>
                <li style="margin: 10px 0; display: flex; align-items: center;">
                  <span style="color: #00ccbe; margin-right: 10px;">✓</span>
                  Unlimited Medical Reports
                </li>
                <li style="margin: 10px 0; display: flex; align-items: center;">
                  <span style="color: #00ccbe; margin-right: 10px;">✓</span>
                  ${user.plan.limits.bookingDiscount}% Discount on Doctor Bookings
                </li>
              </ul>
            </div>
  
            <div style="margin: 20px 0;">
              <div style="font-weight: bold; margin-bottom: 10px;">Subscription Details:</div>
              <div style="background-color: white; padding: 15px; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span>Plan:</span>
                  <span style="font-weight: bold;">Premium</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span>Amount:</span>
                  <span style="font-weight: bold;">$${user.plan.monthly.price}/month</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>Next Billing Date:</span>
                  <span style="font-weight: bold;">${new Date(user.renewalDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
  
            <p>Best regards,</p>
            <p style="color: #00ccbe; font-weight: 600;">AI Medik Team</p>
          </div>
          
          <div style="border-top: 2px solid #00ccbe; margin: 20px 0;"></div>
          
          <!-- Spanish Version -->
          <div>
            <h2 style="color: #00ccbe;">Confirmación de Suscripción Premium</h2>
            
            <div style="margin-bottom: 20px; font-weight: 700;">
              Estimado(a) <span style="font-weight:700; color: #00ccbe; text-transform:uppercase">${user.patientName}</span>
            </div>
            
            <div style="line-height: 1.4;">
              ¡Gracias por suscribirse a nuestro Plan Premium! Su suscripción ha sido activada exitosamente.
            </div>
  
            <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #00ccbe;">
              <h3 style="color: #00ccbe; margin-top: 0;">Sus Beneficios Premium Incluyen:</h3>
              <ul style="list-style: none; padding: 0;">
                <li style="margin: 10px 0; display: flex; align-items: center;">
                  <span style="color: #00ccbe; margin-right: 10px;">✓</span>
                  Consultas AI Ilimitadas
                </li>
                <li style="margin: 10px 0; display: flex; align-items: center;">
                  <span style="color: #00ccbe; margin-right: 10px;">✓</span>
                  Informes Médicos Ilimitados
                </li>
                <li style="margin: 10px 0; display: flex; align-items: center;">
                  <span style="color: #00ccbe; margin-right: 10px;">✓</span>
                  ${user.plan.limits.bookingDiscount}% de Descuento en Reservas Médicas
                </li>
              </ul>
            </div>
  
            <div style="margin: 20px 0;">
              <div style="font-weight: bold; margin-bottom: 10px;">Detalles de la Suscripción:</div>
              <div style="background-color: white; padding: 15px; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span>Plan:</span>
                  <span style="font-weight: bold;">Premium</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span>Monto:</span>
                  <span style="font-weight: bold;">$${user.plan.monthly.price}/mes</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>Próxima Fecha de Facturación:</span>
                  <span style="font-weight: bold;">${new Date(user.renewalDate).toLocaleDateString('es-ES')}</span>
                </div>
              </div>
            </div>
  
            <p>Saludos cordiales,</p>
            <p style="color: #00ccbe; font-weight: 600;">Equipo AI Medik</p>
          </div>
        </div>
      </div>
    </body>
    </html>`;
  };


exports.doctorConsultationReminderTemplate = (user) => {
    return `
<!DOCTYPE html>
<html lang="en">
<body>
    <div style="font-family: Arial, Helvetica, sans-serif; background-color: #F0F3F7; width: 638px; padding: 24px; margin: 0 auto;">
        <div style="width: 150px; height: 60px; margin: 0 auto; margin-bottom: 20px;">
             <img src="${publicPics}/logo-light.png" alt="" style="width:100%; height:100%; object-fit:contain;">
        </div>
        
        <div style="padding: 30px; border-radius: 20px; background-color: #F8F9FB;">
            <!-- English Version -->
            <div>
                <h2 style="color: #00ccbe;">Consultation Reminder</h2>
                
                
                <div style="line-height: 1.4; background-color: #ffffff; padding: 15px; border-radius: 10px; border-left: 4px solid #00ccbe;">
                    <div style="margin-bottom: 10px;">
                        This is a reminder for your upcoming consultation with <span style="color: #00ccbe">${user.name}</span>
                    </div>
                    <div style="margin-bottom: 5px;">
                        <strong>Date:</strong> ${new Date(user.date).toLocaleString('en-US', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        })}
                    </div>
                    <div>
                        <strong>Time:</strong> ${user.time}
                    </div>
                </div>
                
                <div style="margin: 20px 0;">Please ensure you have the following ready before the consultation:</div>
                
                <ul style="background-color: #ffffff; padding: 15px 35px; border-radius: 10px; margin: 15px 0;">
                    <li style="margin-bottom: 10px;">A quiet, well-lit space for the consultation</li>
                    <li style="margin-bottom: 10px;">Stable internet connection</li>
                    <li>Working camera and microphone</li>
                </ul>


                <p>Best regards,</p>
                <p style="color: #00ccbe; font-weight: 600;">AI Medik Team</p>
            </div>
            
            <div style="border-top: 2px solid #00ccbe; margin: 20px 0;"></div>
            
            <!-- Spanish Version -->
            <div>
                <h2 style="color: #00ccbe;">Recordatorio de Consulta</h2>
                
             
                <div style="line-height: 1.4; background-color: #ffffff; padding: 15px; border-radius: 10px; border-left: 4px solid #00ccbe;">
                    <div style="margin-bottom: 10px;">
                        Este es un recordatorio de su próxima consulta con <span style="color: #00ccbe">${user.name}</span>
                    </div>
                    <div style="margin-bottom: 5px;">
                        <strong>Fecha:</strong> ${new Date(user.date).toLocaleString('es-ES', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        })}
                    </div>
                    <div>
                        <strong>Hora:</strong> ${user.time}
                    </div>
                </div>
                
                <div style="margin: 20px 0;">Por favor, asegúrese de tener lo siguiente listo antes de la consulta:</div>
                
                <ul style="background-color: #ffffff; padding: 15px 35px; border-radius: 10px; margin: 15px 0;">
                    <li style="margin-bottom: 10px;">Un espacio tranquilo y bien iluminado para la consulta</li>
                    <li style="margin-bottom: 10px;">Conexión estable a Internet</li>
                    <li>Cámara y micrófono funcionando correctamente</li>
                </ul>

                <p>Saludos cordiales,</p>
                <p style="color: #00ccbe; font-weight: 600;">Equipo AI Medik</p>
            </div>
        </div>
    </div>
</body>
</html>`;
};

exports.patientConsultationReminderTemplate = (user) => {
    return `
<!DOCTYPE html>
<html lang="en">
<body>
    <div style="font-family: Arial, Helvetica, sans-serif; background-color: #F0F3F7; width: 638px; padding: 24px; margin: 0 auto;">
        <div style="width: 150px; height: 60px; margin: 0 auto; margin-bottom: 20px;">
             <img src="${publicPics}/logo-light.png" alt="" style="width:100%; height:100%; object-fit:contain;">
        </div>
        
        <div style="padding: 30px; border-radius: 20px; background-color: #F8F9FB;">
            <!-- English Version -->
            <div>
                <h2 style="color: #00ccbe;">Consultation Reminder</h2>
                
                
                <div style="line-height: 1.4; background-color: #ffffff; padding: 15px; border-radius: 10px; border-left: 4px solid #00ccbe;">
                    <div style="margin-bottom: 10px;">
                        This is a reminder for your upcoming consultation with <span style="color: #00ccbe">${user.name}</span>
                    </div>
                    <div style="margin-bottom: 5px;">
                        <strong>Date:</strong> ${new Date(user.date).toLocaleString('en-US', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        })}
                    </div>
                    <div>
                        <strong>Time:</strong> ${user.time}
                    </div>
                </div>
                
                <div style="margin: 20px 0;">Please ensure you have the following ready before the consultation:</div>
                
                <ul style="background-color: #ffffff; padding: 15px 35px; border-radius: 10px; margin: 15px 0;">
                    <li style="margin-bottom: 10px;">A quiet, well-lit space for the consultation</li>
                    <li style="margin-bottom: 10px;">Stable internet connection</li>
                    <li>Working camera and microphone</li>
                </ul>


                <p>Best regards,</p>
                <p style="color: #00ccbe; font-weight: 600;">AI Medik Team</p>
            </div>
            
            <div style="border-top: 2px solid #00ccbe; margin: 20px 0;"></div>
            
            <!-- Spanish Version -->
            <div>
                <h2 style="color: #00ccbe;">Recordatorio de Consulta</h2>
                
             
                <div style="line-height: 1.4; background-color: #ffffff; padding: 15px; border-radius: 10px; border-left: 4px solid #00ccbe;">
                    <div style="margin-bottom: 10px;">
                        Este es un recordatorio de su próxima consulta con <span style="color: #00ccbe">${user.name}</span>
                    </div>
                    <div style="margin-bottom: 5px;">
                        <strong>Fecha:</strong> ${new Date(user.date).toLocaleString('es-ES', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        })}
                    </div>
                    <div>
                        <strong>Hora:</strong> ${user.time}
                    </div>
                </div>
                
                <div style="margin: 20px 0;">Por favor, asegúrese de tener lo siguiente listo antes de la consulta:</div>
                
                <ul style="background-color: #ffffff; padding: 15px 35px; border-radius: 10px; margin: 15px 0;">
                    <li style="margin-bottom: 10px;">Un espacio tranquilo y bien iluminado para la consulta</li>
                    <li style="margin-bottom: 10px;">Conexión estable a Internet</li>
                    <li>Cámara y micrófono funcionando correctamente</li>
                </ul>

                <p>Saludos cordiales,</p>
                <p style="color: #00ccbe; font-weight: 600;">Equipo AI Medik</p>
            </div>
        </div>
    </div>
</body>
</html>`;
};


exports.contactFormSubmissionTemplate = (submission) => {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Contact Form Submission</title>
    </head>
    <body style="font-family: Arial, Helvetica, sans-serif; background-color: #F0F3F7; margin: 0; padding: 0;">
        <div style="width: 638px; padding: 24px; margin: 0 auto; background-color: #F0F3F7;">
            <div style="width: 150px; height: 60px; margin: 0 auto; margin-bottom: 20px;">
                <img src="${publicPics}/logo-light.png" alt="Company Logo"
                    style="width:100%; height:100%; object-fit:contain;">
            </div>
            
            <div style="background-color: #F8F9FB; border-radius: 24px; padding: 30px 55px;">
                <h1 style="font-style: normal; font-weight: 400; font-size: 24px; color: #313D5B; text-align: center; letter-spacing: 0.02em;">
                    New Contact Form Submission
                </h1>
                
                <div style="background: #fff; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: rgba(0, 0, 0, 0.1) 0px 4px 12px;">
                    <table style="width: 100%; border-collapse: separate; border-spacing: 0 10px;">
                        <tr>
                            <td style="width: 150px; color: #00bfff; font-weight: bold;">Full Name:</td>
                            <td style="color: #313D5B;">${submission.name}</td>
                        </tr>
                        <tr>
                            <td style="color: #00bfff; font-weight: bold;">Email Address:</td>
                            <td style="color: #313D5B;">${submission.email}</td>
                        </tr>
                        <tr>
                            <td style="vertical-align: top; color: #00bfff; font-weight: bold;">Message:</td>
                            <td style="color: #313D5B; white-space: pre-wrap;">${submission.message}</td>
                        </tr>
                    </table>
                </div>
                
                <p style="text-align: center; font-weight: 400; font-size: 14px; color: #6B7280; margin-top: 20px;">
                    This is an automated email from your website's contact form.
                </p>
                
                <div style="text-align: center; margin-top: 20px;">
                    <a href="#" style="display: inline-block; background-color: #00bfff; color: white; padding: 10px 20px; 
                        text-decoration: none; border-radius: 8px; font-weight: bold;">
                        Respond to Inquiry
                    </a>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 20px; color: #6B7280; font-size: 12px;">
                © ${new Date().getFullYear()} AI MediK. All rights reserved.
            </div>
        </div>
    </body>
    </html>`;
};