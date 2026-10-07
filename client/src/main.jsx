import React,{useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import {io} from "socket.io-client";
import "./style.css";

const serverUrl=import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? "http://localhost:3001" : "");
const socket=io(serverUrl,{autoConnect:!!serverUrl});

function App(){ 
 const[screen,setScreen]=useState("home"),[name,setName]=useState(""),[roomCode,setRoomCode]=useState(""),[room,setRoom]=useState(null),[letter,setLetter]=useState("S"),[err,setErr]=useState("");
 const me=room?.players.find(p=>p.id===socket.id),current=room?.players[room.turnIndex],myTurn=current?.id===socket.id;
 useEffect(()=>{
   const onCreated=c=>{setRoomCode(c);setScreen("lobby")};
   const onState=r=>{setRoom(r);setScreen(r.started?"game":"lobby")};
   const onErr=m=>{setErr(m);setTimeout(()=>setErr(""),2200)};
   socket.on("roomCreated",onCreated);socket.on("state",onState);socket.on("errorMessage",onErr);
   if(!serverUrl)setErr("Multiplayer server is not configured.");
   return()=>{socket.off("roomCreated",onCreated);socket.off("state",onState);socket.off("errorMessage",onErr)};
 },[]);
 const create=()=>name.trim()&&socket.emit("createRoom",{name});
 const join=()=>name.trim()&&roomCode.trim()&&socket.emit("joinRoom",{name,code:roomCode});
 const leave=()=>{socket.emit("leaveRoom");setRoom(null);setScreen("home")};

 if(screen==="home")return <main className="screen home"><div className="brand">SOS<span>16</span><small>ONLINE ARENA</small></div><div className="hero"><p className="tag">REAL-TIME MULTIPLAYER</p><h1>Make your <i>SOS.</i><br/>Own the board.</h1><p className="sub">16×16. Friends. One board.</p><input placeholder="YOUR NAME" value={name} onChange={e=>setName(e.target.value)}/><div className="buttons"><button onClick={create}>CREATE ROOM</button><button className="ghost" onClick={()=>setScreen("join")}>JOIN ROOM</button></div></div></main>;

 if(screen==="join")return <main className="screen join"><button className="link" onClick={()=>setScreen("home")}>← Back</button><h1>Join a room</h1><input placeholder="YOUR NAME" value={name} onChange={e=>setName(e.target.value)}/><input placeholder="ROOM CODE" value={roomCode} onChange={e=>setRoomCode(e.target.value.toUpperCase())}/><button onClick={join}>JOIN ROOM</button>{err&&<div className="error">{err}</div>}</main>;

 if(!room)return null;

 if(!room.started)return <main className="screen lobby"><div className="bar"><div className="brand mini">SOS<span>16</span><small>LOBBY</small></div><button className="ghost miniBtn" onClick={leave}>LEAVE</button></div><div className="lobbyCard"><div className="code">{room.code}<small>ROOM CODE</small></div><h1>Waiting for players</h1><div className="players">{room.players.map(p=><div className="player" key={p.id}><b>● {p.name}{p.id===room.hostId?"  HOST":""}</b><span>TEAM {p.team}</span></div>)}</div>{socket.id===room.hostId?<button disabled={room.players.length<2} onClick={()=>socket.emit("startGame")}>START GAME</button>:<p className="muted">Waiting for the host…</p>}{err&&<div className="error">{err}</div>}</div></main>;

 return <main className="screen game"><div className="gameBar"><div className="brand mini">SOS<span>16</span><small>{room.code}</small></div><div className="scores"><span>A {room.scores.A}</span><span>B {room.scores.B}</span></div><button className="ghost miniBtn" onClick={leave}>EXIT</button></div><div className="gameWrap"><aside><h3>PLAYERS</h3>{room.players.map(p=><div className={"side "+(p.id===current?.id?"active":"")} key={p.id}><b>{p.name}</b><small>TEAM {p.team}</small></div>)}<div className="status">{room.winner?(room.winner==="DRAW"?"DRAW":`TEAM ${room.winner} WINS`):!me?"SPECTATING":myTurn?"YOUR TURN":"OPPONENT'S TURN"}</div></aside><section className="play"><div className="board">{room.board.map((row,r)=>row.map((v,c)=><button key={r+"-"+c} className={"cell "+(v||"")} disabled={!myTurn||!!v||!!room.winner} onClick={()=>socket.emit("move",{r,c,letter})}>{v}</button>))}{(room.sosLines||[]).map((cells,i)=>{const[a,_,z]=cells,left=(a[1]+.5)*100/16,top=(a[0]+.5)*100/16,dx=(z[1]-a[1])*100/16,dy=(z[0]-a[0])*100/16,len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)*180/Math.PI;return <span key={i} className="sosLine" style={{left:left+"%",top:top+"%",width:len+"%",transform:"rotate("+angle+"deg)"}}/>})}</div>{!room.winner&&me&&<div className="picker"><button className={letter==="S"?"selected":""} onClick={()=>setLetter("S")}>S</button><button className={letter==="O"?"selected":""} onClick={()=>setLetter("O")}>O</button></div>}</section></div></main>
}
createRoot(document.getElementById("root")).render(<App/>);
