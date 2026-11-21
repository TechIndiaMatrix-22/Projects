const msg=document.getElementById("auth-message");
function showMessage(t){msg.textContent=t||""}
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{
 document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===b));
 document.getElementById("login-panel").classList.toggle("hidden",b.dataset.tab!=="login");
 document.getElementById("register-form").classList.toggle("hidden",b.dataset.tab!=="register");
 showMessage("");
}));
document.querySelectorAll("[data-method]").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll("[data-method]").forEach(item => {
            item.classList.toggle("active", item === button);
        });

        const passwordForm = document.getElementById("password-form");
        const otpPanel = document.getElementById("msg91-panel");

        if (passwordForm && otpPanel) {
            passwordForm.classList.toggle(
                "hidden",
                button.dataset.method !== "password"
            );

            otpPanel.classList.toggle(
                "hidden",
                button.dataset.method !== "msg91"
            );
        }

        showMessage("");
    });
});

async function submitForm(form,url){
 const r=await fetch(url,{method:"POST",body:new FormData(form)});
 const data=await r.json().catch(()=>({detail:"Unexpected server response"}));
 if(!r.ok)throw new Error(data.detail||"Request failed");
 return data;
}
document.getElementById("password-form").addEventListener("submit",async e=>{
 e.preventDefault();try{const d=await submitForm(e.target,"/api/login");location.href=d.redirect||"/dashboard"}catch(x){showMessage(x.message)}
});

const otpStatus=document.getElementById("otp-widget-status");
const sendButton=document.getElementById("otp-send");
const verifyButton=document.getElementById("otp-verify");
const resendButton=document.getElementById("otp-resend");
const phoneInput=document.getElementById("otp-phone");
const otpInput=document.getElementById("otp-code");
let otpReqId=null;
let otpSent=false;

function widgetReady(){
 return typeof window.sendOtp==="function" && typeof window.verifyOtp==="function";
}
function setOtpStatus(message){otpStatus.textContent=message||""}
function normalizeIndiaOrIntlPhone(raw){
 // MSG91 widget expects country code without +. Accept user's +countrycode input too.
 return String(raw||"").replace(/\D/g,"");
}
async function loginWithVerifiedToken(data){
 const token=data && (
   data["access-token"] ||
   data.accessToken ||
   data.token ||
   (data.type === "success" && data.message)
 );
 if(!token){setOtpStatus("MSG91 did not return an access token. Please retry.");return}
 try{
   const response=await fetch("/api/msg91/verify",{
     method:"POST",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({access_token:token})
   });
   const result=await response.json().catch(()=>({detail:"Unexpected server response"}));
   if(!response.ok)throw new Error(result.detail||"Server verification failed.");
   location.href=result.redirect||"/dashboard";
 }catch(error){setOtpStatus(error.message)}
}
sendButton.addEventListener("click",()=>{
 const phone=normalizeIndiaOrIntlPhone(phoneInput.value);
 if(!phone){setOtpStatus("Enter your mobile number with country code.");return}
 if(!widgetReady()){setOtpStatus("MSG91 widget is still loading. Wait a moment and retry.");return}
 sendButton.disabled=true;setOtpStatus("Requesting OTP from MSG91…");
 window.sendOtp(phone,(data)=>{
   otpReqId=(data && (data.reqId||data.req_id||data.request_id))||null;
   otpSent=true;verifyButton.disabled=false;resendButton.classList.remove("hidden");
   setOtpStatus("OTP sent. Check your SMS and enter the code.");
   sendButton.disabled=false;
   // Some widget configurations may return a token immediately (e.g. invisible verification).
   if(data && (data["access-token"]||data.accessToken||data.token)) loginWithVerifiedToken(data);
 },(error)=>{
   setOtpStatus((error && (error.message||error.toString()))||"Could not send OTP.");
   sendButton.disabled=false;
 });
});
verifyButton.addEventListener("click",()=>{
 const code=otpInput.value.trim();
 if(!otpSent){setOtpStatus("Generate an OTP first.");return}
 if(!code){setOtpStatus("Enter the OTP received by SMS.");return}
 if(typeof window.verifyOtp!=="function"){setOtpStatus("MSG91 verification is not ready.");return}
 verifyButton.disabled=true;setOtpStatus("Verifying OTP…");
 window.verifyOtp(code,(data)=>{
   console.log("MSG91 verifyOtp response keys:", Object.keys(data || {}));
   console.log("MSG91 verifyOtp response:", JSON.stringify(data || {}).replace(
       /("(?:access-token|accessToken|token)"\s*:\s*")[^"]*(")/gi,
       "$1[REDACTED]$2"
   ));

   setOtpStatus("OTP verified. Checking account…");
   loginWithVerifiedToken(data);
   verifyButton.disabled=false;
 },(error)=>{
   setOtpStatus((error && (error.message||error.toString()))||"OTP verification failed.");
   verifyButton.disabled=false;
 },otpReqId||undefined);
});
resendButton.addEventListener("click",()=>{
 if(typeof window.retryOtp!=="function"){setOtpStatus("MSG91 resend is not available.");return}
 resendButton.disabled=true;setOtpStatus("Resending OTP…");
 window.retryOtp('11',(data)=>{
   otpReqId=(data && (data.reqId||data.req_id||data.request_id))||otpReqId;
   setOtpStatus("OTP resent. Check your SMS.");resendButton.disabled=false;
 },(error)=>{
   setOtpStatus((error && (error.message||error.toString()))||"Could not resend OTP.");resendButton.disabled=false;
 },otpReqId||undefined);
});
document.getElementById("register-form").addEventListener("submit",async e=>{
 e.preventDefault();try{const d=await submitForm(e.target,"/api/register");showMessage(d.message||"Account created. You can now use password login or SMS OTP.");document.querySelector('[data-tab="login"]').click()}catch(x){showMessage(x.message)}
});

(function initializeMSG91(){
 const config=window.MSG91_WIDGET_CONFIG;
 if(!config) return;
 config.identifier="";
 config.exposeMethods=true;
 config.success=(data)=>console.log("MSG91 widget success callback",data);
 config.failure=(error)=>console.warn("MSG91 widget failure",error);
 const init=()=>{if(typeof window.initSendOTP==="function")window.initSendOTP(config)};
 if(typeof window.initSendOTP==="function"){init();return}
 const sdk=document.querySelector('script[src*="otp-provider.js"]');
 if(sdk)sdk.addEventListener("load",init,{once:true});
})();

// Open REGISTER tab after account deletion
const params = new URLSearchParams(window.location.search);

if (params.get("register") === "1") {
    document.querySelector('[data-tab="register"]')?.click();
}
