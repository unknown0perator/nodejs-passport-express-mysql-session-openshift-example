// .: DB Configuration :.
const mysql = require('mysql'); 
if(typeof process.env.OPENSHIFT_MYSQL_DB_HOST==="undefined"){var dbconf = {host:'localhost',port:3306,user:'adminmr6efRT',password:'MRyJTtszp8ur',database:'pms'}
}else{var dbconf = {host:process.env.OPENSHIFT_MYSQL_DB_HOST,port:process.env.OPENSHIFT_MYSQL_DB_PORT,user:process.env.OPENSHIFT_MYSQL_DB_USERNAME,password:process.env.OPENSHIFT_MYSQL_DB_PASSWORD,database:process.env.OPENSHIFT_APP_NAME,socket:process.env.OPENSHIFT_MYSQL_DB_SOCKET}}    
const dbconn = mysql.createConnection(dbconf); /*or create a pool*/ dbconn.connect();
// .: Express & Other Middleware Modules :.
var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var cookieParser = require('cookie-parser');
var serveStatic = require('serve-static');
// .: Sessions :.
var passport = require('passport');
var GitHubStrategy = require('passport-github2');
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var sessionStore = new MySQLStore(ssconf,dbconn);
var ssconf = {connectionLimit:1,checkExpirationInterval:900000,expiration:86400000,createDatabaseTable:true,schema:{tableName:'LoginRequests',columnNames:{session_id:'loginID',expires:'expires',data:'data'}}};
// .: Server (class) :.
class Server {
  constructor(port, ip){
    this.app = express();
    this.app.use(cookieParser('secret'));
    this.app.use(session({
      key:'session_cookie_name',
      secret:'secret',
      cookie:{maxAge:3600000,secure:false},
      store: sessionStore,
      resave:false,
      saveUninitialized:false
    }));
    this.app.use(passport.initialize());
    this.app.use(passport.session());
    this.app.use(serveStatic(path.join(__dirname,'public')))
    this.app.listen(port,ip,function(){console.log('[i] Application worker started.');});
    //require('./routes/site.js'); //~Example (routes/site.js) :
      this.app.get("/",function(req,res){res.send("<a href='./auth/github'>Click here to login (GitHub)</a>");})
      this.app.get('/auth/github',passport.authenticate('github',{scope:['user:email']}));
      this.app.get('/auth/github/callback',passport.authenticate('github',{failureRedirect:'/'}),function(req,res){res.redirect('/success');});
      // route for valid logins
      this.app.get('/success', function(req, res){ 
        if(req.user){ console.log(req.user);  res.send(req.user); }
        else{ res.redirect('/login'); }
      });
      // route to check the sessionStore table entries in the browser
      this.app.get('/sessions',function(req,res){
        dbconn.query("SELECT * FROM LoginRequests",function(err,rows){
          if(err){console.log(err);}else{
            if(rows.length!=0){
              res.send(JSON.stringify(rows));
              console.log(rows);
            }else{res.send("No LoginRequests found");}
          }
        });
      });
    //require('./config/passport.js')(passport);  //~Example (config/passport.js) :
      passport.use(new GitHubStrategy(
        {clientID:"1374e9cd3f12a172f30f",clientSecret:"dc3b7dc028bddfc848c0fafd7a55e0b4b4f4a2aa",callbackURL:"http://pms-emx.rhcloud.com/auth/github/callback"},
        function(token, tokenSecret, user, cb){CheckUser('github',user,cb);}
      ));
    }
}
const server = new Server(process.env.OPENSHIFT_NODEJS_PORT,process.env.OPENSHIFT_NODEJS_IP);
// .: Passport : Serialize & Deserialize User :.
passport.serializeUser(function(user, done){
 console.log('[passport] serializeUser');
 done(null,user.id);
});
passport.deserializeUser(function(id, done) {
 console.log('[passport] deserializeUser');
  dbconn.query("SELECT * FROM Users WHERE id=?",[id],function(err,rows){
  if(err){console.log(err);}else{
    if(rows.length!=0){ done(err,rows[0]); }
    else{ done(err,null); }
  }
 });
});

//:Check if user exists:
function CheckUser(platform,user,cb){
  dbconn.query("SELECT * FROM Users WHERE id=?",[user.id],function(err,rows){
  if(err){console.log(err); cb(err,null);}else{
    if(rows.length!=0){cb(null,user);}
    else{CreateUser(platform,user,cb);}
    }
  });
}
  //:Create new user:
function CreateUser(platform,user,cb){
  switch(platform){
    case "github": 
      var newUserObj  = {id:user.id,platform:platform,email:user.emails[0].value};
      dbconn.query("INSERT INTO Users SET ?",newUserObj,function(err){
        if(err){console.log(err); cb(err,null);}else{cb(null,user);}
      });
    break;
    default: console.log("[error] (createUser) : platform not implemented :",platform); cb(err,null); break;
  }
}