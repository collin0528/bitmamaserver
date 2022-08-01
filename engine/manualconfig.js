require("dotenv").config(); //bring in the dotenv configuration


//Configure the Authentication Params
const authConfig = {
    authRequired: process.env.AUTH_REQUIRED,
    auth0Logout: process.env.AUTH0_LOGOUT,
    baseURL: process.env.BASE_URL,
    clientID: process.env.CLIENT_ID,
    issuerBaseURL: process.env.ISSUER_BASE_URL,
    secret: process.env.SECRET 
}

const databaseConfig = {
    uri: process.env.DB_URI,
    dbname: process.env.DBNAME
}


const mailConfig = {
    service: process.env.EMAIL_SERVICE,
    user: process.env.EMAIL_ADDRESS,
    password: process.env.PASSWORD
}


module.exports = { authConfig, databaseConfig, mailConfig }