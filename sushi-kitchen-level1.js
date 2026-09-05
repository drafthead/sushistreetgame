(() => {
  const S=window.SS, P=S.PALETTE, U=S.ui, proto=window.SushiScene.prototype;

  const BOARD_FILES=[1];
  const INGREDIENT_FILES=[1,2,3,4,5,6];
  const POT_FILES=[1,2,3];
  const PLATE_FILES=[1,2,3,4];
  const KNIFE_FILES=[1,2,6];

  const KITCHEN_GOAL_ROW=30;
  const KITCHEN_INGREDIENT_SLOTS=4;
  const KITCHEN_INGREDIENT_MIN=2;
  const KITCHEN_PLATE_MIN=3;
  const PLATE_POINTS={1:10,2:20,3:30,4:40};

  const KITCHEN_ROWS={
    1:'entry',2:'roll',3:'plate',4:'ingredient',5:'water',6:'water',7:'pot',8:'knife',9:'plate',10:'roll',
    11:'ingredient',12:'pot',13:'water',14:'water',15:'plate',16:'roll',17:'pot',18:'ingredient',19:'knife',20:'plate',
    21:'water',22:'water',23:'roll',24:'pot',25:'ingredient',26:'plate',27:'roll',28:'pot',29:'finish'
  };

  const key=(kind,n)=>`kitchen-${kind}-${n}`;
  const depth=(scene,y,offset=0)=>scene.depthForY?scene.depthForY(y,offset):10000+Math.round(y*10)+offset;
  const shuffled=(scene,arr)=>arr.slice().sort(()=>((scene.rng?.()??Math.random())-.5));
  const nearestCols=(count)=>{
    const min=1,max=Math.max(1,S.COLS-2);
    if(count<=1)return [Math.round((min+max)/2)];
    const out=[];
    for(let i=0;i<count;i++){
      let col=Math.round(min+(max-min)*(i/(count-1)));
      let guard=0;
      while(out.includes(col)&&guard++<20)col=S.clamp(col+(guard%2?1:-1),min,max);
      out.push(col);
    }
    return out;
  };

  const ensureFrame=()=>{
    let frame=document.getElementById('kitchen-side-frame');
    if(frame)return frame;
    frame=document.createElement('div');
    frame.id='kitchen-side-frame';
    frame.setAttribute('aria-hidden','true');
    frame.innerHTML='<img class="kitchen-side kitchen-side-left" src="images/kitchen/backgrounds/leftside.png" alt=""><img class="kitchen-side kitchen-side-right" src="images/kitchen/backgrounds/rightside.png" alt="">';
    document.body.appendChild(frame);
    return frame;
  };

  const setKitchenFrameVisible=visible=>{
    const frame=ensureFrame();
    frame.classList.toggle('show',Boolean(visible));
    document.body.classList.toggle('kitchen-level-one',Boolean(visible));
  };

  const basePreload=proto.preload;
  proto.preload=function(){
    basePreload.call(this);
    BOARD_FILES.forEach(n=>this.load.image(key('board',n),`images/kitchen/boards/${n}.png`));
    INGREDIENT_FILES.forEach(n=>this.load.image(key('ingredient',n),`images/kitchen/ingredients/${n}.png`));
    POT_FILES.forEach(n=>this.load.image(key('pot',n),`images/kitchen/pots/${n}.png`));
    PLATE_FILES.forEach(n=>this.load.image(key('plate',n),`images/kitchen/plates/${n}.png`));
    KNIFE_FILES.forEach(n=>this.load.image(key('knife',n),`images/kitchen/knives/${n}.png`));
    this.load.image('kitchen-bg-bottom','images/kitchen/backgrounds/bottomside.png');
    this.load.image('kitchen-bg-top','images/kitchen/backgrounds/topside.png');
  };

  const resetKitchenState=function(){
    this._kitchenMode=true;
    this._kitchenIngredientSets=[];
    this._kitchenIngredientsCollected=0;
    this._kitchenIngredientChoices=[];
    this._kitchenPlateCount=0;
    this._kitchenPlatePoints=0;
    this._kitchenPlates=[];
    this._kitchenHazards=[];
    this._kitchenPotCells=new Set();
    this._kitchenKnifeCells=new Set();
    this._kitchenPlateRows=new Map();
    this._kitchenIngredientRows=new Map();
  };

  const baseStartLevel=proto.startLevel;
  proto.startLevel=function(level,opt){
    const requested=Number(level)||1;
    if(requested===1)resetKitchenState.call(this);
    else this._kitchenMode=false;
    const result=baseStartLevel.call(this,level,opt);
    const kitchen=this.selectedLevel===1;
    this._kitchenMode=kitchen;
    setKitchenFrameVisible(kitchen);
    if(kitchen){
      this.cameras?.main?.setRotation?.(0);
      this._startingBestScore=Number(this.save?.bestScores?.[1])||0;
    }else{
      this.cameras?.main?.setRotation?.(S.CAMERA_ROTATION);
    }
    return result;
  };

  const baseOpenLevelSelect=proto.openLevelSelect;
  proto.openLevelSelect=function(...args){
    setKitchenFrameVisible(false);
    return baseOpenLevelSelect.apply(this,args);
  };

  const baseLevelLength=proto.levelLength;
  proto.levelLength=function(level){
    return Number(level)===1?KITCHEN_GOAL_ROW:baseLevelLength.call(this,level);
  };

  const baseBuildMenu=proto.buildMenu;
  proto.buildMenu=function(level){
    if(Number(level)!==1)return baseBuildMenu.call(this,level);
    return S.ITEMS.slice(0,KITCHEN_INGREDIENT_SLOTS);
  };

  const baseDescribeRow=proto.describeRow;
  proto.describeRow=function(i){
    if(this.selectedLevel!==1)return baseDescribeRow.call(this,i);
    if(i===0)return {index:i,type:'start',kitchenKind:'start'};
    if(i>=this.goalRow)return {index:i,type:'goal',kitchenKind:'goal'};
    const kind=KITCHEN_ROWS[i]||'entry';
    if(kind==='water')return {index:i,type:'water',kitchenKind:'water'};
    return {index:i,type:'safe',kitchenKind:kind};
  };

  const basePlanLandObstacles=proto.planLandObstacles;
  proto.planLandObstacles=function(){
    if(this.selectedLevel!==1)return basePlanLandObstacles.call(this);
    this.blockedCells=new Set();
    for(const row of this.rows||[])row.obstacles=[];
  };

  const addRect=function(scene,row,x,y,w,h,color,alpha=1,z=0){
    const obj=scene.track(scene.add.rectangle(x,y,w,h,color,alpha).setDepth(z));
    row.objects.push(obj);
    return obj;
  };

  const addTextureImage=function(scene,row,x,y,texture,targetHeight,offset=50){
    if(!scene.textures.exists(texture))return null;
    const img=scene.add.image(x,y,texture);
    const scale=targetHeight/Math.max(1,img.height);
    img.setScale(scale).setDepth(depth(scene,y,offset));
    img.__rowY=row.y;
    scene.track(img);row.objects.push(img);
    return img;
  };

  const renderCounterBase=function(scene,row,color=0xc9c4ba){
    const d=4+row.index*2,c=S.TRACK_X+S.TRACK_W/2;
    addRect(scene,row,c,row.y+5,S.TRACK_W,S.ROW_H,0x504a49,1,d-1);
    addRect(scene,row,c,row.y,S.TRACK_W,S.ROW_H-5,color,1,d);
    addRect(scene,row,c,row.y-S.ROW_H*.38,S.TRACK_W,5,0xf3eadc,.68,d+1);
    addRect(scene,row,c,row.y+S.ROW_H*.38,S.TRACK_W,7,0x7c7470,.9,d+1);
    return d;
  };

  const renderConveyor=function(scene,row,accent=0xffffff){
    const d=renderCounterBase(scene,row,0x5b5d63),c=S.TRACK_X+S.TRACK_W/2;
    addRect(scene,row,c,row.y,S.TRACK_W,S.ROW_H*.56,0x30343c,1,d+2);
    addRect(scene,row,c,row.y-S.ROW_H*.25,S.TRACK_W,4,0x878d97,.8,d+3);
    addRect(scene,row,c,row.y+S.ROW_H*.25,S.TRACK_W,4,0x1f2228,.9,d+3);
    const arrowCount=Math.max(5,Math.floor(S.PLAY_W/110));
    for(let i=0;i<arrowCount;i++){
      const x=S.PLAY_X+(i+.5)*S.PLAY_W/arrowCount;
      const g=scene.track(scene.add.graphics().setDepth(d+4));
      g.fillStyle(accent,.42);g.fillTriangle(x-7,row.y-5,x+7,row.y,x-7,row.y+5);
      row.objects.push(g);
    }
    return d;
  };

  const createRollingSushi=function(scene,row,x,dir,index){
    const c=scene.add.container(x,row.y-2).setDepth(depth(scene,row.y,58));
    const g=scene.add.graphics();c.add(g);
    const cucumber=(index+row.index)%2===1;
    const w=S.clamp(S.CELL_W*1.05,44,72),h=S.clamp(S.ROW_H*.48,27,34);
    g.fillStyle(P.shadow,.23);g.fillEllipse(6,9,w*.86,h*.52);
    if(cucumber){
      g.fillStyle(0x315f2f,1);g.fillRoundedRect(-w*.5,-h*.34,w,h*.68,8);
      g.fillStyle(0x86c642,1);g.fillRoundedRect(-w*.38,-h*.24,w*.76,h*.48,6);
      for(let s=-w*.2;s<=w*.2;s+=w*.2){g.fillStyle(0x436f31,.75);g.fillRect(s-2,-h*.22,4,h*.44);}
      g.fillStyle(0xd7f07f,.9);g.fillCircle(dir*w*.34,0,4);
    }else{
      g.fillStyle(0x171b1b,1);g.fillRoundedRect(-w*.5,-h*.38,w,h*.76,7);
      g.fillStyle(0xf4efe2,1);g.fillCircle(dir*w*.33,0,h*.27);
      g.fillStyle(0xee7460,1);g.fillCircle(dir*w*.33,0,h*.11);
    }
    const hazard={obj:c,row:row.index,width:w,vx:dir*(58+scene.selectedLevel*2+(scene.rng?.()??.5)*18),cycleStart:S.PLAY_X-w*1.6,cycleLength:S.PLAY_W+w*3.2};
    c.__kitchenHazard=hazard;scene._kitchenHazards.push(hazard);scene.track(c);row.objects.push(c);
    return c;
  };

  const renderIngredientRow=function(scene,row){
    const d=renderCounterBase(scene,row,0xd4d0c8);
    const set={row:row.index,taken:false,items:[]};
    const cols=nearestCols(INGREDIENT_FILES.length);
    INGREDIENT_FILES.forEach((n,i)=>{
      const col=cols[i],x=scene.colX(col);
      const img=addTextureImage(scene,row,x,row.y-3,key('ingredient',n),S.clamp(S.ROW_H*.72,38,50),58);
      if(!img)return;
      img.__kitchenIngredient={set,file:n,col};set.items.push(img);
      const tile=scene.track(scene.add.rectangle(x,row.y+S.ROW_H*.29,S.CELL_W*.76,5,0xe9e4dc,.9).setDepth(d+3));row.objects.push(tile);
    });
    scene._kitchenIngredientSets.push(set);scene._kitchenIngredientRows.set(row.index,set);
    const label=scene.track(scene.add.text(S.PLAY_X+S.PLAY_W/2,row.y-S.ROW_H*.37,'PICK ONE INGREDIENT',{fontFamily:'Inter,system-ui,sans-serif',fontSize:'9px',fontStyle:'900',color:'#4d4640',backgroundColor:'rgba(255,248,235,.78)',padding:{x:6,y:2}}).setOrigin(.5).setDepth(d+5));row.objects.push(label);
  };

  const renderPlateRow=function(scene,row){
    renderConveyor(scene,row,0xf8fff6);
    const candidates=shuffled(scene,PLATE_FILES).slice(0,Math.min(3,PLATE_FILES.length));
    const cols=nearestCols(candidates.length+2).slice(1,-1);const list=[];
    candidates.forEach((n,i)=>{
      const col=cols[i]??S.START_COL,x=scene.colX(col);
      const img=addTextureImage(scene,row,x,row.y-4,key('plate',n),S.clamp(S.ROW_H*.78,42,54),58);if(!img)return;
      const data={obj:img,row:row.index,col,file:n,points:PLATE_POINTS[n]||10,collected:false};img.__kitchenPlate=data;list.push(data);scene._kitchenPlates.push(data);
    });
    scene._kitchenPlateRows.set(row.index,list);
  };

  const renderPotRow=function(scene,row){
    const d=renderCounterBase(scene,row,0x34363b);const burnerCols=nearestCols(5);
    burnerCols.forEach((col,i)=>{const x=scene.colX(col);const burner=scene.track(scene.add.ellipse(x,row.y+4,S.CELL_W*.64,S.ROW_H*.36,i%2?0xb93d25:0x17191c,.9).setDepth(d+2));row.objects.push(burner);});
    const potCols=[burnerCols[0],burnerCols[Math.floor(burnerCols.length/2)],burnerCols[burnerCols.length-1]].filter((v,i,a)=>a.indexOf(v)===i);const pots=shuffled(scene,POT_FILES);
    potCols.forEach((col,i)=>{const x=scene.colX(col),n=pots[i%pots.length];const img=addTextureImage(scene,row,x,row.y-6,key('pot',n),S.clamp(S.ROW_H*.88,47,61),65);scene.blockedCells.add(`${row.index}:${col}`);scene._kitchenPotCells.add(`${row.index}:${col}`);if(img)img.__kitchenPot=true;});
  };

  const renderKnifeRow=function(scene,row){
    renderCounterBase(scene,row,0xc89554);const cols=nearestCols(5);const obstacleCols=[cols[1],cols[3]].filter(v=>Number.isFinite(v));const files=shuffled(scene,KNIFE_FILES);
    obstacleCols.forEach((col,i)=>{const x=scene.colX(col);const img=addTextureImage(scene,row,x,row.y-2,key('knife',files[i%files.length]),S.clamp(S.ROW_H*.56,31,41),62);if(img){img.setAngle(i%2?4:-4);img.__kitchenKnife=true;}scene.blockedCells.add(`${row.index}:${col}`);scene._kitchenKnifeCells.add(`${row.index}:${col}`);});
  };

  const renderWater=function(scene,row){
    const d=4+row.index*2,c=S.TRACK_X+S.TRACK_W/2;
    addRect(scene,row,c,row.y+7,S.TRACK_W,S.ROW_H,0x285f86,1,d-1);addRect(scene,row,c,row.y,S.TRACK_W,S.ROW_H-5,0x42a9d9,1,d);addRect(scene,row,c,row.y-S.ROW_H*.35,S.TRACK_W,5,0x8ae3ff,.75,d+1);addRect(scene,row,c,row.y+S.ROW_H*.36,S.TRACK_W,6,0x2678a9,.9,d+1);
    const waves=Math.max(8,Math.floor(S.PLAY_W/80));
    for(let i=0;i<waves;i++){const x=S.PLAY_X+(i+.35)*S.PLAY_W/waves,w=S.clamp(S.CELL_W*(.32+(i%3)*.12),18,42);addRect(scene,row,x,row.y-8+(i%2)*15,w,3,0xd9f7ff,.44,d+2);addRect(scene,row,x+11,row.y+4+(i%3)*8,w*.52,2,0x88daf8,.42,d+2);}
    scene.buildFloaters(row);
  };

  const renderStartOrGoal=function(scene,row,goal=false){
    const d=4+row.index*2,c=S.TRACK_X+S.TRACK_W/2;addRect(scene,row,c,row.y,S.TRACK_W,S.ROW_H,goal?0xc3aaa1:0xc9b8aa,1,d);
    const texture=goal?'kitchen-bg-top':'kitchen-bg-bottom';
    if(scene.textures.exists(texture)){const img=scene.add.image(S.PLAY_X+S.PLAY_W/2,row.y+(goal?-S.ROW_H*.56:S.ROW_H*.62),texture);const targetW=S.PLAY_W+8;const scale=targetW/Math.max(1,img.width);img.setScale(scale).setOrigin(.5,goal?.78:.24).setDepth(d+1);scene.track(img);row.objects.push(img);}
    if(goal){const line=scene.track(scene.add.text(S.PLAY_X+S.PLAY_W/2,row.y+S.ROW_H*.18,'SUSHI PREP • FINISH',{fontFamily:'Inter,system-ui,sans-serif',fontSize:'10px',fontStyle:'900',color:'#fff7ec',backgroundColor:'rgba(50,40,38,.74)',padding:{x:8,y:3}}).setOrigin(.5).setDepth(depth(scene,row.y,40)));row.objects.push(line);}
  };

  const baseRenderRow=proto.renderRow;
  proto.renderRow=function(row){
    if(this.selectedLevel!==1)return baseRenderRow.call(this,row);row.objects=row.objects||[];
    switch(row.kitchenKind){
      case 'start':return renderStartOrGoal(this,row,false);case 'goal':return renderStartOrGoal(this,row,true);case 'water':return renderWater(this,row);case 'ingredient':return renderIngredientRow(this,row);case 'plate':return renderPlateRow(this,row);case 'pot':return renderPotRow(this,row);case 'knife':return renderKnifeRow(this,row);
      case 'roll':{renderConveyor(this,row,0xf8fff6);const dir=row.index%2?1:-1,count=Math.max(2,Math.min(4,Math.floor(S.W/310)+2)),cycleW=S.PLAY_W+S.CELL_W*3;for(let i=0;i<count;i++)createRollingSushi(this,row,S.PLAY_X-S.CELL_W*1.4+(i+.5)*cycleW/count,dir,i);return;}
      case 'finish':case 'entry':default:{const d=renderCounterBase(this,row,0xd7cec2),c=S.TRACK_X+S.TRACK_W/2;addRect(this,row,c,row.y,S.TRACK_W,S.ROW_H*.14,0xf1e2cd,.62,d+2);}
    }
  };

  const baseBuildFloaters=proto.buildFloaters;
  proto.buildFloaters=function(row){
    if(this.selectedLevel!==1)return baseBuildFloaters.call(this,row);
    const dir=row.index%2?1:-1,boardW=S.clamp(S.CELL_W*1.28,54,84),gap=S.clamp(S.CELL_W*.62,28,43),side=boardW+gap,cycleStart=S.PLAY_X-side,cycleLength=S.PLAY_W+side*2;
    let count=Math.max(4,Math.floor(cycleLength/(boardW+gap)));const spacing=cycleLength/count,phase=(this.rng?.()??.5)*spacing,files=shuffled(this,BOARD_FILES),rowSpeed=dir*(38+(this.rng?.()??.5)*10);
    for(let i=0;i<count;i++){
      const n=files[i%files.length];if(!this.textures.exists(key('board',n)))continue;
      const img=this.add.image(cycleStart+phase+i*spacing,row.y-2,key('board',n));const scale=boardW/Math.max(1,img.width);img.setScale(scale).setDepth(depth(this,row.y,38));img.__rowY=row.y;
      img.__float={vx:rowSpeed,width:boardW,hitWidth:boardW*.82,kind:'kitchen-board',stationary:false,left:S.PLAY_X,right:S.PLAY_X+S.PLAY_W,cycleStart,cycleLength};row.floaters.push(img);this.floaters.push(img);this.track(img);row.objects.push(img);
    }
  };

  const baseRequestMove=proto.requestMove;
  proto.requestMove=function(dx,dy){
    if(this.selectedLevel===1&&this.player){
      const col=S.clamp(this.playerCol+dx,0,S.COLS-1),row=S.clamp(this.playerRow+dy,0,this.goalRow);
      if(col<1||col>S.COLS-2){this.playSfx?.('bump');return;}
      const pot=this._kitchenPotCells?.has(`${row}:${col}`),knife=this._kitchenKnifeCells?.has(`${row}:${col}`);
      if(pot||knife){this.beginRunClock?.();return this.failRun(pot?'HOT POT!':'KNIFE BLOCK!',pot?'The chef ran straight into a hot pot. Hop through the open burner gaps.':'The prep knife blocked the landing. Use the open counter space.','traffic');}
    }
    return baseRequestMove.call(this,dx,dy);
  };

  const baseCollectAt=proto.collectAt;
  proto.collectAt=function(rowIndex){
    if(this.selectedLevel!==1)return baseCollectAt.call(this,rowIndex);
    const set=this._kitchenIngredientRows?.get(rowIndex);
    if(set&&!set.taken){
      let chosen=null;for(const img of set.items){const data=img.__kitchenIngredient;if(data&&Math.abs(this.player.x-img.x)<=S.CELL_W*.48){chosen=img;break;}}
      if(chosen){
        set.taken=true;this._kitchenIngredientsCollected++;const data=chosen.__kitchenIngredient;this._kitchenIngredientChoices.push(data.file);const item=S.ITEMS[(data.file-1)%S.ITEMS.length];this.score+=item?.points||10;this.playSfx?.('pickup');this.animatePickupToBag?.(chosen,item||S.ITEMS[0]);
        for(const img of set.items){if(img===chosen){this.tweens.add({targets:img,scaleX:img.scaleX*1.12,scaleY:img.scaleY*1.12,alpha:.12,duration:240,ease:'Quad.Out',onComplete:()=>img.setVisible(false)});}else{img.setTint?.(0x777777);img.setAlpha(.38);}}
        const msg=this.track(this.add.text(chosen.x,chosen.y-S.ROW_H*.7,`INGREDIENT +${item?.points||10}`,{fontFamily:'Inter,system-ui,sans-serif',fontSize:'11px',fontStyle:'900',color:'#182229',backgroundColor:'#f8f858',padding:{x:7,y:3}}).setOrigin(.5).setDepth(depth(this,chosen.y,90)));this.tweens.add({targets:msg,y:msg.y-18,alpha:0,duration:480,onComplete:()=>msg.destroy()});
      }
    }
    const plates=this._kitchenPlateRows?.get(rowIndex)||[];
    for(const p of plates){if(p.collected||!p.obj?.visible||Math.abs(this.player.x-p.obj.x)>S.CELL_W*.45)continue;p.collected=true;this._kitchenPlateCount++;this._kitchenPlatePoints+=p.points;this.score+=p.points;this.playSfx?.('pickup');const msg=this.track(this.add.text(p.obj.x,p.obj.y-S.ROW_H*.62,`PLATE +${p.points}`,{fontFamily:'Inter,system-ui,sans-serif',fontSize:'11px',fontStyle:'900',color:'#fff',backgroundColor:'#3d586f',padding:{x:7,y:3}}).setOrigin(.5).setDepth(depth(this,p.obj.y,90)));this.tweens.add({targets:p.obj,alpha:0,scaleX:p.obj.scaleX*.55,scaleY:p.obj.scaleY*.55,duration:180,onComplete:()=>p.obj.setVisible(false)});this.tweens.add({targets:msg,y:msg.y-18,alpha:0,duration:480,onComplete:()=>msg.destroy()});}
    this.updateHud?.();
  };

  const baseCollectedCount=proto.collectedCount;proto.collectedCount=function(){return this.selectedLevel===1?(this._kitchenIngredientsCollected||0):baseCollectedCount.call(this);};
  const baseRequiredCount=proto.requiredCount;proto.requiredCount=function(){return this.selectedLevel===1?KITCHEN_INGREDIENT_SLOTS:baseRequiredCount.call(this);};
  const baseMinimumCount=proto.minimumCount;proto.minimumCount=function(){return this.selectedLevel===1?KITCHEN_INGREDIENT_MIN:baseMinimumCount.call(this);};
  const baseMenuRatio=proto.menuRatio;proto.menuRatio=function(){return this.selectedLevel===1?Math.min(1,(this._kitchenIngredientsCollected||0)/KITCHEN_INGREDIENT_SLOTS):baseMenuRatio.call(this);};

  const baseUpdateHud=proto.updateHud;
  proto.updateHud=function(...args){
    const result=baseUpdateHud.apply(this,args);
    if(this.selectedLevel===1){
      const got=this._kitchenIngredientsCollected||0,plates=this._kitchenPlateCount||0,ingProgress=Math.min(1,got/KITCHEN_INGREDIENT_MIN),plateProgress=Math.min(1,plates/KITCHEN_PLATE_MIN),openProgress=Math.round(Math.min(ingProgress,plateProgress)*100),label=document.querySelector('.minimum-copy span');
      if(label)label.textContent='KITCHEN ORDER';if(U.minimumText)U.minimumText.textContent=`ING ${got}/${KITCHEN_INGREDIENT_MIN} • PLATES ${plates}/${KITCHEN_PLATE_MIN}`;if(U.minimumFill)U.minimumFill.style.width=`${openProgress}%`;U.minimumPanel?.classList.toggle('ready',got>=KITCHEN_INGREDIENT_MIN&&plates>=KITCHEN_PLATE_MIN);
    }else{const label=document.querySelector('.minimum-copy span');if(label)label.textContent='INGREDIENTS';}
    return result;
  };

  const baseFinishDelivery=proto.finishDelivery;
  proto.finishDelivery=function(){
    if(this.selectedLevel!==1)return baseFinishDelivery.call(this);if(this.runEnded)return;
    const got=this._kitchenIngredientsCollected||0,plates=this._kitchenPlateCount||0;
    if(got<KITCHEN_INGREDIENT_MIN||plates<KITCHEN_PLATE_MIN){
      this.runEnded=true;this.inputLocked=true;this.clearBufferedMove?.();this.cancelGesture?.();this.showRestaurantClosedSign?.();const missing=[];
      if(got<KITCHEN_INGREDIENT_MIN)missing.push(`${KITCHEN_INGREDIENT_MIN-got} more ingredient${KITCHEN_INGREDIENT_MIN-got===1?'':'s'}`);if(plates<KITCHEN_PLATE_MIN)missing.push(`${KITCHEN_PLATE_MIN-plates} more plate${KITCHEN_PLATE_MIN-plates===1?'':'s'}`);
      const body=`You reached the sushi counter, but you still need ${missing.join(' and ')}. Pick one ingredient from each choice belt and collect enough plates, then try again.`;this.time.delayedCall(400,()=>{if(this.runEnded)this.showResult(false,'ORDER NOT READY',body,0);});return;
    }
    return baseFinishDelivery.call(this);
  };

  const baseUpdate=proto.update;
  proto.update=function(time,delta){
    baseUpdate.call(this,time,delta);if(this.selectedLevel!==1||this.runEnded||!this.runActive||!this.player)return;const dt=Math.min(delta,40)/1000;
    for(const h of this._kitchenHazards||[]){const o=h.obj;if(!o?.active)continue;const next=o.x+h.vx*dt;o.x=h.cycleStart+((((next-h.cycleStart)%h.cycleLength)+h.cycleLength)%h.cycleLength);if(this.playerRow===h.row&&!this.isMoving&&Math.abs(o.x-this.player.x)<=h.width*.46){this.player?.setVisible?.(false);this.playerArt?.setVisible?.(false);this.playerShadow?.setVisible?.(false);this.failRun('SUSHI ROLL HIT','A rolling sushi piece knocked the chef off the prep line. Read the belt direction and hop through the gap.','traffic');break;}}
  };

  ensureFrame();
})();
