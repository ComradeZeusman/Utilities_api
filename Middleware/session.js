import flash from "connect-flash";
import session from "express-session";
import MongoStore from "connect-mongo";
import passport from "passport";

async function sessionManagement(app) {
  const sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60, // 1 day
  });

  const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
  });

  app.use(sessionMiddleware);
  app.use(flash());
  app.set("view engine", "ejs");
  app.use(passport.initialize());
  app.use(passport.session());
}

export default sessionManagement;
