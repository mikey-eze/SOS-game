import express from "express";
import cors from "cors";
import {createServer} from "node:http";
import {Server} from "socket.io";
import crypto from "node:crypto";

const app=express(); app.use(cors());
const httpServer=createServer(app);
const io=new Server(httpServer,{cors:{origin:"*",methods:["GET","POST"]}});
const rooms=new Map(), SIZE=16;
const emptyBoard=()=>Array.from({length:SIZE},()=>Array(SIZE).fill(null));
const code=()=>crypto.randomBytes(3).toString("hex").toUpperCase();
const inside=(r,c)=>r>=0&&r<SIZE&&c>=0&&c<SIZE;
const lineKey=line=>line.map(([r,c])=>r+","+c).sort().join("|");

function pub(room){
  return {code:room.code,hostId:room.hostId,started:room.started,board:room.board,turnIndex:room.turnIndex,scores:room.scores,
    players:room.players,winner:room.winner,sosLines:room.sosLines};
}
function checkSOS(board,r,c){
  const hits=[],seen=new Set(),dirs=[[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]];
  const add=line=>{const k=lineKey(line);if(!seen.has(k)){seen.add(k);hits.push(line)}};
  for(const [dr,dc] of dirs){
    if(board[r][c]==="O"){
      const a=[r-dr,c-dc],z=[r+dr,c+dc];
      if(inside(...a)&&inside(...z)&&board[a[0]][a[1]]==="S"&&board[z[0]][z[1]]==="S") add([a,[r,c],z]);
    } else if(board[r][c]==="S"){
      const o=[r+dr,c+dc],z=[r+2*dr,c+2*dc];
      if(inside(...o)&&inside(...z)&&board[o[0]][o[1]]==="O"&&board[z[0]][z[1]]==="S") add([[r,c],o,z]);
    }
  }
  return hits;
}
function broadcast(room){io.to(room.code).emit("state",pub(room));}
function next(room){room.turnIndex=(room.turnIndex+1)%room.players.length;}

io.on("connection",socket=>{
  socket.on("createRoom",({name})=>{
    let c=code();while(rooms.has(c))c=code();
    const room={code:c,hostId:socket.id,started:false,board:emptyBoard(),turnIndex:0,scores:{A:0,B:0},players:[],winner:null,usedSOS:new Set(),sosLines:[]};
    room.players.push({id:socket.id,name:(name||"Player").slice(0,20),team:"A",connected:true});
    rooms.set(c,room);socket.join(c);socket.data.roomCode=c;socket.emit("roomCreated",c);broadcast(room);
  });
  socket.on("joinRoom",({code,name})=>{
    const room=rooms.get(String(code||"").toUpperCase());
    if(!room)return socket.emit("errorMessage","Room not found.");
    if(room.started)return socket.emit("errorMessage","Game already started.");
    if(room.players.length>=8)return socket.emit("errorMessage","Room is full.");
    const a=room.players.filter(p=>p.team==="A").length,b=room.players.filter(p=>p.team==="B").length;
    const team=a<=b?"A":"B";
    room.players.push({id:socket.id,name:(name||"Player").slice(0,20),team,connected:true});
    socket.join(room.code);socket.data.roomCode=room.code;broadcast(room);
  });
  socket.on("startGame",()=>{
    const room=rooms.get(socket.data.roomCode);if(!room||room.hostId!==socket.id)return;
    if(room.players.length<2)return socket.emit("errorMessage","Need at least 2 players.");
    room.started=true;room.board=emptyBoard();room.turnIndex=0;room.scores={A:0,B:0};room.winner=null;room.usedSOS=new Set();room.sosLines=[];broadcast(room);
  });
  socket.on("move",({r,c,letter})=>{
    const room=rooms.get(socket.data.roomCode);if(!room||!room.started||room.winner)return;
    const p=room.players[room.turnIndex];
    if(!p||p.id!==socket.id)return socket.emit("errorMessage","Not your turn.");
    if(!["S","O"].includes(letter)||!inside(r,c)||room.board[r][c])return socket.emit("errorMessage","Invalid move.");
    room.board[r][c]=letter;
    const fresh=[];
    for(const line of checkSOS(room.board,r,c)){
      const key=lineKey(line);
      if(!room.usedSOS.has(key)){room.usedSOS.add(key);room.sosLines.push(line);fresh.push(line)}
    }
    if(fresh.length)room.scores[p.team]+=fresh.length;else next(room);
    if(room.board.every(row=>row.every(Boolean))){
      const a=room.scores.A,b=room.scores.B;room.winner=a===b?"DRAW":a>b?"A":"B";
    }
    broadcast(room);
  });
  socket.on("leaveRoom",()=>{
    const room=rooms.get(socket.data.roomCode);if(!room)return;
    room.players=room.players.filter(p=>p.id!==socket.id);
    if(room.hostId===socket.id)room.hostId=room.players[0]?.id;
    if(!room.players.length)rooms.delete(room.code);else{room.turnIndex=Math.min(room.turnIndex,Math.max(0,room.players.length-1));broadcast(room)}
    socket.leave(room.code);socket.data.roomCode=null;
  });
  socket.on("disconnect",()=>{const room=rooms.get(socket.data.roomCode);if(room){const p=room.players.find(x=>x.id===socket.id);if(p)p.connected=false;broadcast(room)}});
});
app.get("/health",(_,res)=>res.json({ok:true,rooms:rooms.size}));
const PORT=process.env.PORT||3001;\nhttpServer.listen(PORT,"0.0.0.0",()=>console.log(`SOS server running on http://0.0.0.0:${PORT}`));
