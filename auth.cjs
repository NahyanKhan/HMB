const session = require("express-session");
const db = require("./db.cjs");

class DatabaseStore extends session.Store {
    get(sid, callback) {
        const query =
            "web_sessions?sid=eq." + encodeURIComponent(sid) +
            "&expires_at=gt." + encodeURIComponent(new Date().toISOString());
        db(query)
            .then(rows => callback(null, rows[0]?.data || null))
            .catch(callback);
    }
    set(sid, data, callback) {
        db("web_sessions", "POST", {
            sid,
            data,
            expires_at: new Date(data.cookie.expires).toISOString()

        })
            .then(() => callback(null))
            .catch(callback);

    }
    destroy(sid, callback) {
        db(
            "web_sessions?sid=eq." + encodeURIComponent(sid),
            "DELETE"

        )
            .then(() => callback(null))
            .catch(callback);

    }
    touch(sid, data, callback) {
        db(
            "web_sessions?sid=eq." + encodeURIComponent(sid),
            "PATCH",
            {
                expires_at: new Date(data.cookie.expires).toISOString()
            }
        )
            .then(() => callback(null))
            .catch(callback);
    }
}
module.exports = session({
    name: "mane.sid",
    secret: process.env.SESSION_SECRET,
    store: new DatabaseStore(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
});
