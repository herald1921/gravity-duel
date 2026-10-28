export interface MultiplayerAPI {
  isInstantMultiplayer?: boolean;
  inviteParams?: Record<string, unknown> | null;
  inviteLink?(params: Record<string, string>): string;
  updateRoom?(room: {roomId:string;isJoinable:boolean;inviteParams:{room:string}}): void;
  leftRoom?(): void;
  addJoinRoomListener?(listener:(params:Record<string,unknown>)=>void): void;
  removeJoinRoomListener?(listener:(params:Record<string,unknown>)=>void): void;
}
type Launch = {joinCode?:string;autoCreate?:boolean};
type RoomState = {code:string;started:boolean;players:readonly unknown[]};
export function inviteRoom(value:unknown):string|undefined {
  if(typeof value!=='string')return;
  const code=value.trim().toUpperCase();return /^[A-Z0-9]{8}$/.test(code)?code:undefined;
}
/** Keep platform invitations separate from the game's network transport. */
export class CrazyMultiplayer {
  private api?:MultiplayerAPI;private pending?:Launch;private handler?:(code:string)=>void;
  private roomCode?:string;private sent='';
  private listener=(params:Record<string,unknown>)=>{
    const code=inviteRoom(params?.room);if(!code||code===this.roomCode)return;
    if(this.handler)this.handler(code);else this.pending={joinCode:code};
  };
  attach(api:MultiplayerAPI):void {
    if(this.api)return;this.api=api;
    const code=inviteRoom(api.inviteParams?.room);
    this.pending=code?{joinCode:code}:api.isInstantMultiplayer?{autoCreate:true}:undefined;
    try{api.addJoinRoomListener?.(this.listener);}catch{/* Solo play remains available. */}
  }
  takeLaunch():Launch|undefined{const launch=this.pending;this.pending=undefined;return launch;}
  onJoin(handler:(code:string)=>void):()=>void{this.handler=handler;return()=>{if(this.handler===handler)this.handler=undefined;};}
  update(room:RoomState|null):void {
    if(!room){this.leave();return;}
    const isJoinable=!room.started&&room.players.length<4;
    const key=room.code+':'+isJoinable;if(key===this.sent)return;
    try{this.api?.updateRoom?.({roomId:room.code,isJoinable,inviteParams:{room:room.code}});this.sent=key;this.roomCode=room.code;}catch{/* Retry on the next room update. */}
  }
  leave():void{if(!this.sent)return;try{this.api?.leftRoom?.();}catch{}this.sent='';this.roomCode=undefined;}
  invite(code:string):string|undefined{try{return this.api?.inviteLink?.({room:code});}catch{return undefined;}}
  destroy():void{this.leave();try{this.api?.removeJoinRoomListener?.(this.listener);}catch{}this.api=undefined;this.handler=undefined;this.pending=undefined;}
}
