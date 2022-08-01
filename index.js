// var createError = require('http-errors');
var express = require('express');
var path = require('path');
const bodyParser = require("body-parser");
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require("bcrypt");
 require("dotenv").config(); //bring in the dotenv package.
const { authConfig, databaseConfig, mailConfig } = require("./engine/manualconfig");
var logger = require('morgan');
const nodemailer = require("nodemailer");
const mongodb = require("mongodb");
const session = require("express-session"); 
const mongodbSession = require("connect-mongodb-session")(session);
const PORT = 6111;


//create the mongodb client
const MongoClient = mongodb.MongoClient;
const client = new MongoClient(databaseConfig.uri)



//middleware
var server = express();
server.use(bodyParser.urlencoded({extended: true}));
server.use(cors());
server.use(express.json())

const mongodbSessionStore = new mongodbSession({
  uri: databaseConfig.uri,
  databaseName: "bitmama-sessions",
  collection: "bitmama-sessions"
})


//bring in the session
server.use(session({
  secret: authConfig.secret,
  resave: false,
  saveUninitialized: false,
  store: mongodbSessionStore

}))


//Routes index
server.get("/", function(req, res){

    res.send("Hello Collins welcome to BITMAMA")
})


//Email Setup
var transporter = nodemailer.createTransport({
  service: mailConfig.service,
  auth: {
    user: mailConfig.user,
    pass: mailConfig.password
  }
});

//functions
const internally_check_user_exists = async (email, password) => {

  console.log("Checking Password: ", password);

  const feedback = await client.db(databaseConfig.dbname).collection("users").findOne({ "email": email });

  if(feedback){
    //compare with the email address
    const isMatchedPassword = await bcrypt.compare(password, feedback.password);

    if(isMatchedPassword){
      return {
        message: "user is valid",
        code: "valid-user",
        data: { email: feedback.email , firstname: feedback.firstname, lastname: feedback.lastname, username: feedback.username }
      }

    }else{
      return{
        message: "user is invalid",
        code: "invalid-user",
        data: null
  
      }
    }

  }else{
    return{
      message: "user is invalid",
      code: "invalid-user",
      data: null

    }
  }
}



 //logout the user 
server.post("/logout", function(req, res){
 
  req.session.destroy(function(error){
    if(error) throw error;

    res.redirect("/login");

  })

})


//Endpoints

//Login User
server.post("/login-user", async function(request, response){

  const {email, password } = request.body;

  //check the user again ....
  const feedback = await internally_check_user_exists(email, password);

  console.log("checks: ", feedback)
  if(feedback){
    if(feedback.code == "valid-user"){
      request.session.loginStatus = {
        "is_user_logged_in": true,
        "email": feedback.data.email,
        "firstname" : feedback.data.firstname,
        "lastname": feedback.data.lastname,
        "username": feedback.data.username
    }
      
     //redirect
     response.send({
      message: "user logged in successfully",
      code: "authenticated",
      data: {}
    })



  }else{

    response.send({
      message: "invalid email/password combination",
      code: "not-authenticated",
      data: {}
    })

  }

  }

})


//Register User
server.post("/register-user", async function(request, response){
    const firstname = request.body.firstname
    const lastname = request.body.lastname
    const username = request.body.username
    const email = request.body.email
    const password = request.body.password

    //hash the password
    let hashedPassword = await bcrypt.hash(password, 12);


    const email_link = `http://localhost:6111/verify_account?email=${email}&&key=123`;

    //send email to this user
    const mailOptions =  {
      from: 'bitmama4321@gmail.com',
      to: email,
      subject: `Activate Your Account`,
      html: `<body>
                  <h3>Congratulations.</h3>
                  <hr>
                  Your account has been created. Please verify by clicking the link 
                  below: <br>
                  <a target='_blank' href='${email_link}'>${email_link}</a>
          </body>`
    };

    transporter.sendMail(mailOptions, async function(error, info){
      if (error) {
          console.log(error);
          throw error
        } else {
          console.log('Email sent: ' + info.response);

          //save to database
          const feedback = await client.db("bitmama").collection("users").insertOne({
            firstname: firstname,
            lastname: lastname,
            username: username,
            email: email,
            password: hashedPassword,
            key: 123,
            is_user_verified: false

          })
          
          if(feedback){
            //emai sent
            response.send("Email was sent to "+email)
          }
          
  
        
        }
  
  
    })
    
})



//check if this user exists already
server.post("/check-user-details", async function(request, response){

  const email = request.body.email;
  const password = request.body.password;

  const feedback = await client.db(databaseConfig.dbname).collection("users").findOne({ "email": email });

  if(feedback){
      //this user is a valid user..
      const isPasswordMatched = await bcrypt.compare(password, feedback.password);
      if(isPasswordMatched){
        response.send({
          message: "user is valid",
          code: "valid-user",
          data: { email: feedback.email , firstname: feedback.firstname, lastname: feedback.lastname, username: feedback.username }
        })
      }else{
        response.send({
          message: "user is invalid",
          code: "invalid-user",
          data: null
        })
      }

  }else{

    response.send({
      message: "user is invalid",
      code: "invalid-user",
      data: null

    })

  }
  

})




//verify your account

server.get("/verify_account", async function(request, response){

  //console.log(request.query);
  let email = request.query.email;
  let key = request.query.key;

  //check the database to see if the query data matches
  //check if email exists
  const feedback = await client.db("bitmama").collection("users").findOne({'email': email})

  console.log(feedback);

  if(feedback != null){
    //the email exists
    //check the key
    console.log(feedback);

    if(feedback.key == key ){
      
      //check if this user has been verified already..
      const verified = await client.db("bitmama").collection("users").findOne({"is_user_verified": true});
      if(verified){
        response.send("account-verified-already-status");
      }else{
          //if not verified
        const updateFeedback = await client.db("bitmama").collection("users").updateOne({"email": email}, {$set: {"is_user_verified": true }})

        console.log(updateFeedback);
        if(updateFeedback){
          response.send("account-verified");
      }
      }

    }else{
      response.send("error", {
        message: "Your link is invalid",
        error: {
          stack: "The problem is the key",
          status: 402
        }
      });
    }

    
  }else{
    response.send("error", {
      message: "You link is invalid", 
      error: {
        stack: "The problem is the email",
        status: 402
      }
    });
  }

})



//check if this user exists already
server.get("/replaceinfo-user-details", async function(request, response){
  const firstname = request.body.firstname
  const lastname = request.body.lastname
  const username = request.body.username
  const email = request.body.email
  const password = request.body.password

  const feedback = await client.db(databaseConfig.dbname).collection("users").findOne({ "email": email });

  if(feedback){
      //this user is a valid user..
      const isPasswordMatched = await bcrypt.compare(password, feedback.password);
      if(isPasswordMatched){
        response.send({
          message: "user is valid",
          code: "valid-user",
          data: { email: feedback.email , firstname: feedback.firstname, lastname: feedback.lastname, username: feedback.username }
        })
      }else{
        //if not verified
      const updateFeedback = await client.db("bitmama").collection("users").replaceOne({"email": email}, {$set: {"is_user_verified": true }})

      console.log(updateFeedback);
      if(updateFeedback){
        response.send("account-verified");
    }
    }
      
      {
        response.send({
          message: "user is invalid",
          code: "invalid-user",
          data: null
        })
      }

  }else{

    response.send({
      message: "user is invalid",
      code: "invalid-user",
      data: null

    })

  }
  

})

//Listen
server.listen(PORT, function(){
    console.log('carry go Serve is active!!')
})