var usernames = {};
var rooms = {};

var express = require('express');
var app = express();
var fs = require('fs');
var https = require('https').Server({
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
}, app);

var bodyParser = require('body-parser');
var ejs = require('ejs');
var io = require('socket.io')(https);
app.set('view engine', 'ejs');


https.listen(8888, function() {
    console.log('listening on https://localhost:8888');
});

app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
    extended: true
}));

app.get('/', function(req, res) {
    var html = "";
    ejs.renderFile(__dirname + '/login.html', {
        "msg": " "
    }, function(err, str) {
        html = str;
    });
    res.send(html);
    res.end();

});

app.post('/', function(request, response) {
    var userName = request.body.userName;
    var roomName = request.body.room;
    var authKey = request.body.auth;
    console.log("username entered :" + userName + " room entered " + roomName + " key is : " + authKey);
    var patt = /[^a-z\d]/i;
    console.log("Not valid username: (false says valid)" + patt.test(userName));
    if ((userName == "" || roomName == "") || (patt.test(userName) || patt.test(roomName))) {
        var html = "";
        ejs.renderFile(__dirname + '/login.html', {
            "msg": "Only Alphanumeric input is accepted"
        }, function(err, str) {
            html = str;
        });
        response.send(html);
        response.end();
    } else if (authKey != "webrtc@123#") {
        var html = "";
        ejs.renderFile(__dirname + '/login.html', {
            "msg": "Invalid Auth Key"
        }, function(err, str) {
            html = str;
        });
        response.send(html);
        response.end();
    } else if (usernames[userName]) {
        var html = "";
        ejs.renderFile(__dirname + '/login.html', {
            "msg": "Username not avialable..Choose another"
        }, function(err, str) {
            html = str;
        });
        response.send(html);
        response.end();
    } else {
        var html = "";
        ejs.renderFile(__dirname + '/index.html', {
            "user": userName,
            "room": roomName
        }, function(err, str) {
            html = str;
        });
        response.send(html);
        response.end();
    }
});

app.use(express.static(__dirname));


io.sockets.on('connection', function(socket) {
    console.log('a user connected: ' + socket);

    socket.on('addUser', function(username, room) {
        console.log('Adding user' + username);
        socket.username = username;
        socket.room = room;
        usernames[username] = socket;
        socket.join(room);
        if (!rooms[room])
            rooms[room] = {};
        rooms[room][username] = username;
        socket.emit('updateChat', 'SERVER', 'You are now connected to room: ' + socket.room);
        socket.broadcast.to(socket.room).emit('updateChat', 'SERVER', socket.username + ' has join the room: ' + socket.room);
        socket.broadcast.to(socket.room).emit('updateUsers', Object.keys(rooms[room]), username);
        socket.emit('updateUsers', Object.keys(rooms[room]), username);
    });

    socket.on('chatMessage', function(data) {
        socket.broadcast.to(socket.room).emit('updateChat', socket.username, data);
        console.log(socket.room + ' : data is ' + data + " user:" + socket.username);
    });

    socket.on('disconnect', function() {
        console.log('deleting');
        if ((!!socket) && usernames[socket.username])
            delete usernames[socket.username];
        if ((!!socket) && rooms[socket.room][socket.username])
            delete rooms[socket.room][socket.username];
        if (!(!socket)) {
            console.log('left');
            socket.broadcast.to(socket.room).emit('updateUsers', Object.keys(rooms[socket.room]), "");
            socket.broadcast.to(socket.room).emit('updateChat', 'SERVER', socket.username + ' has left', socket.username);
            socket.leave(socket.room);
        }
    });

    socket.on('chat message', function(msg) {
        var signal = JSON.parse(msg);
        var to = signal.choosed;
        console.log("Received: " + msg + " to be send to: " + signal.choosed);
        signal.choosed = socket.username;
        console.log('Now sending to: ' + to + " choosing: " + signal.choosed);
        msg = JSON.stringify(signal);
        usernames[to].emit('chat message', msg);
    });

});