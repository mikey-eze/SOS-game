import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import "./style.css";

const TOTAL_ROUNDS=7;
const sizes=[4,6,8,10,12,14,16];
const roundThemes=["sand","clay","sage","blue","plum","amber","rose"];
const directions=[[0,1],[1,0],[1,1],[1,-1]];
const emptyBoard=n=>Array.from({length:n},()=>Array(n).fill(null));
const inside=(n,r,c)=>r>=0&&r<n&&c>=0&&c<n;
const lineKey=l=>l.map(([r,c])=>r+","+c).sort().join("|");

function findSOS(b,r,c){
  const n=b.length,h=[],seen=new Set();
  const add=l=>{const k=lineKey(l);if(!seen.has(k)){seen.add(k);h.push(l)}};
  for(const[dr,dc]of directions){
    if(b[r][c]==="O"){
      const a=[r-dr,c-dc],z=[r+dr,c+dc];
      if(inside(n,...a)&&inside(n,...z)&&b[a[0]][a[1]]==="S"&&b[z[0]][z[1]]==="S")add([a,[r,c],z]);
    }else{
      const o=[r+dr,c+dc],z=[r+2*dr,c+2*dc],o2=[r-dr,c-dc],z2=[r-2*dr,c-2*dc];
      if(inside(n,...o)&&inside(n,...z)&&b[o[0]][o[1]]==="O"&&b[z[0]][z[1]]==="S")add([[r,c],o,z]);
      if(inside(n,...o2)&&inside(n,...z2)&&b[o2[0]][o2[1]]==="O"&&b[z2[0]][z2[1]]==="S")add([[r,c],o2,z2]);
    }
  }
  return h;
}

function App(){
  const[screen,setScreen]=useState("home");
  const[names,setNames]=useState(["PLAYER 1","PLAYER 2"]);
  const[round,setRound]=useState(1);
  const[board,setBoard]=useState(emptyBoard(4));
  const[owners,setOwners]=useState(emptyBoard(4));
  const[scores,setScores]=useState([0,0]);
  const[rs,setRs]=useState([0,0]);
  const[turn,setTurn]=useState(0);
  const[letter,setLetter]=useState("S");
  const[lines,setLines]=useState([]);
  const[used,setUsed]=useState(new Set());
  const[winner,setWinner]=useState(null);
  const[gameWinner,setGameWinner]=useState(null);
  const[message,setMessage]=useState("");
  const[flash,setFlash]=useState([]);
  const n=sizes[round-1];

  const start=()=>{
    const x=names.map((v,i)=>v.trim()||"PLAYER "+(i+1));
    setNames(x);setRound(1);setBoard(emptyBoard(4));setOwners(emptyBoard(4));
    setScores([0,0]);setRs([0,0]);setTurn(0);setLetter("S");setLines([]);
    setUsed(new Set());setWinner(null);setGameWinner(null);setMessage("");setFlash([]);setScreen("game");
  };

  const next=()=>{
    const r=round+1;
    setRound(r);setBoard(emptyBoard(sizes[r-1]));setOwners(emptyBoard(sizes[r-1]));
    setRs([0,0]);setTurn(0);setLetter("S");setLines([]);setUsed(new Set());
    setWinner(null);setMessage("");setFlash([]);
  };

  const move=(r,c)=>{
    if(board[r][c]||winner!==null)return;
    const b=board.map(x=>x.slice()),o=owners.map(x=>x.slice());
    b[r][c]=letter;o[r][c]=turn;
    const fresh=findSOS(b,r,c).filter(l=>!used.has(lineKey(l)));
    const u=new Set(used);fresh.forEach(l=>u.add(lineKey(l)));
    const gain=fresh.length,a=[...rs],s=[...scores];
    a[turn]+=gain;s[turn]+=gain;
    setBoard(b);setOwners(o);setUsed(u);
    const hitCells=[...new Set(fresh.flat().map(([rr,cc])=>rr+","+cc))];
    setFlash(hitCells);
    window.setTimeout(()=>setFlash([]),900);
    setLines([...lines,...fresh.map((cells,j)=>({cells,player:turn,delay:j*140}))]);
    setRs(a);setScores(s);
    if(b.every(row=>row.every(Boolean))){
      const rw=a[0]===a[1]?"DRAW":a[0]>a[1]?0:1;
      setWinner(rw);
      if(round===TOTAL_ROUNDS)setGameWinner(s[0]===s[1]?"DRAW":s[0]>s[1]?0:1);
      return;
    }
    setTurn(gain?turn:1-turn);
    setMessage(gain?names[turn]+" scored +"+gain+" SOS — play again!":"");
  };

  if(screen==="home")return <main className="screen home">
    <div className="brand">SOS<span>16</span><small>LOCAL TWO-PLAYER ARENA</small></div>
    <div className="hero">
      <p className="tag">7 ROUND SHOWDOWN</p>
      <h1>Make your <i>SOS.</i><br/>Own the board.</h1>
      <p className="sub">Two players. One screen. 4×4 → 16×16.</p>
      <input placeholder="PLAYER 1" value={names[0]} onChange={e=>setNames([e.target.value,names[1]])}/>
      <input placeholder="PLAYER 2" value={names[1]} onChange={e=>setNames([names[0],e.target.value])}/>
      <div className="buttons"><button onClick={start}>START MATCH</button></div>
    </div>
  </main>;

  if(screen==="result")return <main className="screen result">
    <div className="brand">SOS<span>16</span><small>FINAL RESULT</small></div>
    <div className="resultCard">
      <p className="tag">7 ROUNDS COMPLETE</p>
      <h1>{gameWinner==="DRAW"?"DRAW":names[gameWinner]+" WINS"}</h1>
      <div className="finalScores">
        <div className="playerCard p1"><b>{names[0]}</b><strong>{scores[0]}</strong></div>
        <div className="playerCard p2"><b>{names[1]}</b><strong>{scores[1]}</strong></div>
      </div>
      <button onClick={()=>setScreen("home")}>PLAY AGAIN</button>
    </div>
  </main>;

  return <main className={"screen game theme-"+roundThemes[round-1]} style={{"--roundAccent":roundThemes[round-1]}}>
    <div className="gameBar">
      <div className="brand mini">SOS<span>16</span><small>LOCAL TWO-PLAYER</small></div>
      <button className="ghost miniBtn" onClick={()=>setScreen("home")}>EXIT</button>
    </div>

    <section className="scoreboard">
      <div className="roundInfo"><span>ROUND {round} / {TOTAL_ROUNDS}</span><b>{n}×{n}</b><small>BOARD</small></div>
      <div className={"scorePlayer p1 "+(turn===0&&winner===null?"active":"")}>
        <small>PLAYER 1</small><strong>{scores[0]}</strong><b>{names[0]}</b><em>{rs[0]} THIS ROUND</em>
      </div>
      <div className="vs">VS</div>
      <div className={"scorePlayer p2 "+(turn===1&&winner===null?"active":"")}>
        <small>PLAYER 2</small><strong>{scores[1]}</strong><b>{names[1]}</b><em>{rs[1]} THIS ROUND</em>
      </div>
    </section>

    <div className={"turnBanner "+(winner!==null?"done":"p"+(turn+1))}>
      {winner!==null?(winner==="DRAW"?"ROUND DRAW":names[winner]+" WINS ROUND"):(message||"NOW PLAYING · "+names[turn])}
    </div>

    <div className="gameWrap">
      <aside><div className="rules"><b>HOW TO PLAY</b><br/>Make SOS horizontally, vertically or diagonally.<br/>SOS = +1 point and you play again.<br/>No SOS = turn switches.</div></aside>
      <section className="play">
        <div className="board" style={{gridTemplateColumns:"repeat("+n+",1fr)"}}>
          {board.map((row,r)=>row.map((v,c)=><button key={r+"-"+c} className={"cell "+(v||"")+" p"+(owners[r][c]!==null?owners[r][c]+1:"")+(flash.includes(r+","+c)?" hit":"")} disabled={!!v||winner!==null} onClick={()=>move(r,c)}>{v}</button>))}
          {lines.map(({cells,player,delay},i)=>{
            const[a,_,z]=cells,left=(a[1]+.5)*100/n,top=(a[0]+.5)*100/n,dx=(z[1]-a[1])*100/n,dy=(z[0]-a[0])*100/n,len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)*180/Math.PI;
            return <span key={i} className={"sosLine p"+(player+1)} style={{left:left+"%",top:top+"%",width:len+"%", "--angle":angle+"deg","--delay":(delay||0)+"ms"}}><i/></span>;
          })}
        </div>

        {winner===null&&<div className="picker">
          <button className={letter==="S"?"selected":""} onClick={()=>setLetter("S")}>S</button>
          <button className={letter==="O"?"selected":""} onClick={()=>setLetter("O")}>O</button>
        </div>}

        {winner!==null&&round<TOTAL_ROUNDS&&<button className="nextRound" onClick={next}>START ROUND {round+1} · {sizes[round]}×{sizes[round]}</button>}
        {winner!==null&&round===TOTAL_ROUNDS&&<button className="nextRound" onClick={()=>setScreen("result")}>VIEW FINAL RESULT</button>}
      </section>
    </div>
  </main>;
}
createRoot(document.getElementById("root")).render(<App/>);
