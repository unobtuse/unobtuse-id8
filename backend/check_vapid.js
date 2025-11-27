require('dotenv').config();
console.log('VAPID_PUBLIC_KEY:', process.env.VAPID_PUBLIC_KEY ? 'Set' : 'Not Set');
console.log('VAPID_PRIVATE_KEY:', process.env.VAPID_PRIVATE_KEY ? 'Set' : 'Not Set');
if (process.env.VAPID_PUBLIC_KEY) {
    console.log('Public Key Length:', process.env.VAPID_PUBLIC_KEY.length);
    console.log('Public Key Start:', process.env.VAPID_PUBLIC_KEY.substring(0, 10));
}