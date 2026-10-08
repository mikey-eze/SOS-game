const SIZE=16;

export class Room {
  constructor(state, env) {
    this.state=state;
    this.env=env;
    this.sockets=new Map();
    this.room=null;
  }

  async fetch(request) {
    if(request.headers.get("Upgrade")!=="websocket") {
      return new Response("SOS room server",{status:426});
    }

    const url=new URL(request.url);
    const name=(url.searchParams.get("name")||"Player").slice(0,20);
    const create=url.searchParams.get("create")==="1";

    if(!this.room) {
      if(!create) return this.sendError("Room not found.");
      this.room={
        code:url.searchParams.get("code")||"",
        hostId:null,
        started:false,
        board:emptyBoard(),
        turnIndex:0,
        scores:{A:0,B:0},
        players:[],
        winner:null,
        usedSOS:new Set(),
        sosLines:[]
      };
    } else if(create) {
      return this.sendError("Room already exists.");
    }

    const pair=new WebSocketPair();
    const client=pair[0];
    const server=pair[1];
    const id=crypto.randomUUID();

    server.accept();
    this.sockets.set(id,server);
    server.addEventListener("message",event=>this.onMessage(id,event.data));
    server.addEventListener("close",()=>this.onClose(id));
    server.addEventListener("error",()=>this.onClose(id));

    if(!this.room.hostId) this.room.hostId=id;
    if(this.room.started) {
      server.send(JSON.stringify({type:"error",message:"Game already started."}));
      server.close();
      return new Response(null,{status:101,webSocket:client});
    }
    if(this.room.players.length>=8) {
      server.send(JSON.stringify({type:"error",message:"Room is full."}));
      server.close();
      return new Response(null,{status:101,webSocket:client});
    }

    const a=this.room.players.filter(p=>p.team==="A").length;
    const b=this.room.players.filter(p=>p.team==="B").length;
    const team=a<=b?"A":"B";
    this.room.players.push({id,name:name||"Player",team,connected:true});
    server.send(JSON.stringify({type:"welcome",id}));
    this.broadcast();

    return new Response(null,{status:101,webSocket:client});
  }

  onMessage(id,raw) {
    let msg;
    try { msg=JSON.parse(raw); } catch { return this.send(id,{type:"error",message:"Invalid message."}); }
    const room=this.room;
    if(!room) return;

    if(msg.type==="leave") {\n      const idx=room.players.findIndex(p=>p.id===id);\n      if(idx>=0) room.players.splice(idx,1);\n      if(room.hostId===id) room.hostId=room.players[0]?.id||null;\n      if(room.turnIndex>=room.players.length) room.turnIndex=0;\n      this.sockets.delete(id);\n      this.broadcast();\n      return;\n    }\n\n    if(msg.type==="start") {
      if(room.hostId!==id) return;
      if(room.players.length<2) return this.send(id,{type:"error",message:"Need at least 2 players."});
      room.started=true;
      room.board=emptyBoard();
      room.turnIndex=0;
      room.scores={A:0,B:0};
      room.winner=null;
      room.usedSOS=new Set();
      room.sosLines=[];
      return this.broadcast();
    }

    if(msg.type==="move") {
      if(!room.started||room.winner) return;
      const p=room.players[room.turnIndex];
      if(!p||p.id!==id) return this.send(id,{type:"error",message:"Not your turn."});
      const r=Number(msg.r),c=Number(msg.c),letter=msg.letter;
      if(!["S","O"].includes(letter)||!inside(r,c)||room.board[r][c]) {
        return this.send(id,{type:"error",message:"Invalid move."});
      }
      room.board[r][c]=letter;
      const fresh=[];
      for(const line of checkSOS(room.board,r,c)) {
        const key=lineKey(line);
        if(!room.usedSOS.has(key)) {
          room.usedSOS.add(key);
          room.sosLines.push(line);
          fresh.push(line);
        }
      }
      if(fresh.length) room.scores[p.team]+=fresh.length;
      else room.turnIndex=(room.turnIndex+1)%room.players.length;
      if(room.board.every(row=>row.every(Boolean))) {
        const a=room.scores.A,b=room.scores.B;
        room.winner=a===b?"DRAW":a>b?"A":"B";
      }
      return this.broadcast();
    }
  }

  onClose(id) {
    if(!this.room) return;
    this.sockets.delete(id);
    const p=this.room.players.find(x=>x.id===id);
    if(p) p.connected=false;
    this.broadcast();
  }

  send(id,msg) {
    const ws=this.sockets.get(id);
    if(ws&&ws.readyState===1) ws.send(JSON.stringify(msg));
  }

  broadcast() {
    if(!this.room) return;
    const state=pub(this.room);
    const msg=JSON.stringify({type:"state",state});
    for(const ws of this.sockets.values()) {
      if(ws.readyState===1) ws.send(msg);
    }
  }

  sendError(message) {
    return new Response(JSON.stringify({error:message}),{status:404,headers:{"content-type":"application/json"}});
  }
}

function emptyBoard(){return Array.from({length:SIZE},()=>Array(SIZE).fill(null));}
function inside(r,c){return r>=0&&r<SIZE&&c>=0&&c<SIZE;}
function lineKey(line){return line.map(([r,c])=>r+","+c).sort().join("|");}
function pub(room){
  return {
    code:room.code,hostId:room.hostId,started:room.started,board:room.board,
    turnIndex:room.turnIndex,scores:room.scores,players:room.players,
    winner:room.winner,sosLines:room.sosLines
  };
}
function checkSOS(board,r,c){
  const hits=[],seen=new Set();
  const dirs=[[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]];
  const add=line=>{const k=lineKey(line);if(!seen.has(k)){seen.add(k);hits.push(line);}};
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

function roomId(code,env){return env.ROOMS.idFromName(code);}
function code(){
  const bytes=new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return [...bytes].map(x=>x.toString(16).padStart(2,"0")).join("").toUpperCase();
}

export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(url.pathname==="/health") return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json"}});
    if(url.pathname==="/create") {
      const c=code();
      const roomUrl=new URL(request.url);
      roomUrl.pathname="/room/"+c;
      roomUrl.searchParams.set("name",url.searchParams.get("name")||"Player");
      roomUrl.searchParams.set("create","1");
      roomUrl.searchParams.set("code",c);
      return env.ROOMS.get(env.ROOMS.idFromName(c)).fetch(new Request(roomUrl,request));
    }
    const match=url.pathname.match(/^\/room\/([A-Z0-9]+)$/i);
    if(match) {
      const c=match[1].toUpperCase();
      const target=new URL(request.url);
      target.pathname="/";
      target.searchParams.set("name",url.searchParams.get("name")||"Player");
      target.searchParams.set("create",url.searchParams.get("create")||"0");
      target.searchParams.set("code",c);
      return env.ROOMS.get(env.ROOMS.idFromName(c)).fetch(new Request(target,request));
    }
    return new Response("SOS multiplayer backend");
  }
};
