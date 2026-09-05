(() => {
  const S=window.SS, P=S.PALETTE, U=S.ui, proto=window.SushiScene.prototype;

  proto.syncSoundButton=function(){
    if(!U.sound)return;
    const on=this.save?.soundEnabled!==false;
    U.sound.classList.toggle('muted',!on);
    U.sound.setAttribute('aria-pressed',String(on));
    U.sound.setAttribute('aria-label',on?'Turn sound off':'Turn sound on');
    const img=U.sound.querySelector('img');
    if(img){img.src=on?'images/icons/volume-on.svg':'images/icons/volume-off.svg';img.alt='';}
  };

  const addSupport=(scene,row,obj,meta)=>{
    obj.__float=meta;
    obj.__waterRow=row.index;
    obj.__rowY=row.y;
    obj.setDepth?.(scene.depthForY?scene.depthForY(row.y,36):60);
    row.floaters.push(obj);
    scene.floaters.push(obj);
    scene.track(obj);
    return obj;
  };

  const buildPads=(scene,row)=>{
    const wide=S.W>=900;
    const padCount=wide?5:4;
    const minCol=1,maxCol=Math.max(1,S.COLS-2);
    const fractions=wide?[.10,.30,.50,.70,.90]:[.12,.37,.63,.88];
    const cols=[];

    fractions.forEach((fraction,i)=>{
      let col=Math.round(minCol+fraction*(maxCol-minCol));
      if(i%2===1)col+=row.index%2===0?1:-1;
      col=S.clamp(col,minCol,maxCol);
      let guard=0;
      while(cols.some(c=>Math.abs(c-col)<2)&&guard++<24){
        col=S.clamp(col+(guard%2?1:-1),minCol,maxCol);
      }
      if(cols.some(c=>Math.abs(c-col)<2)){
        for(let candidate=minCol;candidate<=maxCol;candidate++){
          if(!cols.some(c=>Math.abs(c-candidate)<2)){col=candidate;break;}
        }
      }
      cols.push(col);
      const w=S.clamp(S.CELL_W*1.2,52,96);
      const pad=scene.createFloater(scene.colX(col),row.y-2,w,'lily',1);
      addSupport(scene,row,pad,{vx:0,width:w,hitWidth:w*.86,kind:'lily',stationary:true,left:S.PLAY_X,right:S.PLAY_X+S.PLAY_W});
    });
    row.stationaryPadCols=cols;
  };

  const buildLogs=(scene,row)=>{
    const wide=S.W>=900;
    const dir=scene.rng()>.5?1:-1;
    const speed=(28+scene.selectedLevel*.9+Math.floor(scene.rng()*7))*dir;
    const logW=S.clamp(S.CELL_W*1.45,66,102);
    const minGap=S.clamp(S.CELL_W*.78,38,56);
    const sideBuffer=logW+minGap;
    const cycleStart=S.PLAY_X-sideBuffer;
    const cycleLength=S.PLAY_W+sideBuffer*2;
    const targetSpacing=logW+minGap;
    let count=Math.max(wide?6:4,Math.floor(cycleLength/targetSpacing));
    count=Math.max(3,count);
    let spacing=cycleLength/count;
    while(count>3&&spacing<logW+minGap*.7){
      count--;spacing=cycleLength/count;
    }
    const actualW=Math.min(logW,Math.max(58,spacing-minGap));
    const phase=(row.index%2)*Math.min(minGap*.28,12);

    for(let i=0;i<count;i++){
      const x=cycleStart+phase+i*spacing;
      const log=scene.createFloater(x,row.y-2,actualW,'log',dir);
      addSupport(scene,row,log,{vx:speed,width:actualW,hitWidth:actualW*.82,kind:'log',stationary:false,left:S.PLAY_X,right:S.PLAY_X+S.PLAY_W,cycleStart,cycleLength});
    }
  };

  // Every blue gameplay row gets a visible support type. No boats.
  // The final row of each connected river is always stationary lily pads.
  // Earlier rows alternate logs and pads so there is never a blank blue row.
  proto.buildFloaters=function(row){
    const prevWater=this.rows[row.index-1]?.type==='water';
    const nextWater=this.rows[row.index+1]?.type==='water';
    const isFinal=!nextWater;
    const isSingle=!prevWater&&!nextWater;
    const relativeIndex=(()=>{let i=row.index;while(this.rows[i-1]?.type==='water')i--;return row.index-i;})();

    if(isFinal||isSingle||relativeIndex%2===1)buildPads(this,row);
    else buildLogs(this,row);

    if(!row.floaters.length)buildPads(this,row);
  };

  proto.ensureWaterSupports=function(){
    for(const row of this.rows){
      if(row?.type!=='water')continue;
      if(!Array.isArray(row.floaters))row.floaters=[];
      const live=row.floaters.filter(f=>f?.active!==false&&f?.visible!==false&&f?.__float);
      if(live.length)continue;
      buildPads(this,row);
    }
  };

  const baseBuildRows=proto.buildRows;
  proto.buildRows=function(){
    baseBuildRows.call(this);
    this.ensureWaterSupports();
  };

  proto.findSupportAt=function(rowIndex,x){
    const row=this.rows[rowIndex];
    if(!row||row.type!=='water')return null;
    return row.floaters.find(obj=>{
      if(!obj?.active||obj.visible===false||!obj.__float)return false;
      const hitWidth=obj.__float.hitWidth||obj.__float.width*.8;
      return Math.abs(x-obj.x)<=hitWidth*.5;
    })||null;
  };

  // Normalize every Sushi Master by height rather than width.
  proto.spawnPlayer=function(){
    this.playerRow=0;this.playerCol=S.START_COL;
    const c=this.add.container(this.colX(S.START_COL),this.rowY(0)).setDepth(82),shadow=this.add.graphics();
    shadow.fillStyle(P.shadow,.3);shadow.fillEllipse(12,22,S.clamp(S.CELL_W*.92,40,62),S.clamp(S.ROW_H*.18,11,16));c.add(shadow);
    const art=this.add.container(0,-7),chef=S.CHEFS.find(ch=>ch.id===(this.save?.selectedChef||S.CHEFS[0].id)),runKey=`chef-run-${chef?.id||S.CHEFS[0].id}`;

    if(chef&&this.textures.exists(runKey)){
      const img=this.add.image(0,20,runKey);
      const targetHeight=S.clamp(S.ROW_H*1.42,78,94);
      img.setOrigin(.5,1).setScale(targetHeight/Math.max(1,img.height));
      art.add(img);
    }else{
      const g=this.add.graphics(),s=S.clamp(S.CELL_W*.64,28,40);art.add(g);
      this.drawBox(g,-s*.18,14,s*.28,s*.24,3,0x5e4238,{shadow:false});this.drawBox(g,s*.18,14,s*.28,s*.24,3,0x5e4238,{shadow:false});
      this.drawBox(g,0,2,s*.62,s*.65,5,P.cabin,{shadow:false,front:0xe1e5ee,right:0xb8b7ce});this.drawBox(g,0,-13,s*.52,s*.42,4,0xffd8b0,{shadow:false,front:0xe3ac89,right:0xc88d72});this.drawBox(g,0,-34,s*.72,s*.3,5,P.cabin,{shadow:false,front:0xdedfed,right:0xaaa8c2});
    }
    c.add(art);this.player=this.track(c);this.playerArt=art;this.playerShadow=shadow;this.playerSupport=null;this.playerSupportOffsetX=0;
  };
})();