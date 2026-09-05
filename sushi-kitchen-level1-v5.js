(() => {
  const S=window.SS, proto=window.SushiScene.prototype;
  const INGREDIENT_FILES=[1,2,3,4,5,6], BOARD_FILES=[1];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const depth=(scene,y,o=0)=>scene.depthForY?scene.depthForY(y,o):10000+Math.round((Number(y)||0)*10)+o;
  const exists=(scene,key)=>scene.textures?.exists?.(key);

  const chooseCenters=(centers,count,left,right)=>{
    if(Array.isArray(centers)&&centers.length){
      if(count===1)return [centers[Math.floor(centers.length/2)]];
      const out=[];
      for(let i=0;i<count;i++)out.push(centers[Math.round(i*(centers.length-1)/(count-1))]);
      return out;
    }
    return Array.from({length:count},(_,i)=>left+(i+.5)*(right-left)/count);
  };

  const nearestCol=(scene,x)=>{
    let best=0,dist=Infinity;
    for(let col=0;col<S.COLS;col++){
      const d=Math.abs(scene.colX(col)-x);
      if(d<dist){dist=d;best=col;}
    }
    return best;
  };

  // V4 made the ingredient art about 2x the first prototype. Pull that size
  // back by 30% while keeping every ingredient centered on the connected tile
  // cells underneath it.
  proto.buildKitchenIngredientStation=function(row){
    const left=S.PLAY_X,right=S.PLAY_X+S.PLAY_W;
    const xs=chooseCenters(row.__kitchenTileCenters,INGREDIENT_FILES.length,left,right);
    const group={rowIndex:row.index,collected:false,chosen:null,items:[]};
    this.kitchenIngredientGroups.push(group);

    INGREDIENT_FILES.forEach((file,i)=>{
      const texture=`kitchen-ingredient-${file}`,x=xs[i],y=row.y-2;
      let item;
      if(exists(this,texture)){
        item=this.add.image(x,y,texture).setDepth(depth(this,y,52));
        const targetH=clamp(S.ROW_H*.87,48,64);
        item.setScale(targetH/Math.max(1,item.height||1)).setOrigin(.5,.58);
      }else{
        item=this.add.circle(x,y,16,0xf8f858,1).setDepth(depth(this,y,52));
      }
      const col=nearestCol(this,x);
      item.__rowY=row.y;
      item.__kitchenIngredient={file,col,group,points:12};
      this.track(item);row.objects.push(item);group.items.push(item);
    });
  };

  // Keep every board in a lane at one velocity so spacing can never collapse,
  // but use deliberately uneven circular spacing so the boards do not look
  // like one continuous train immediately behind each other.
  proto.buildKitchenBoards=function(row){
    const dir=row.index%2===0?1:-1;
    const width=clamp(S.CELL_W*.98,44,72);
    const baseGap=clamp(S.CELL_W*.72,34,54);
    const cycleStart=S.PLAY_X-width-baseGap;
    const cycleLength=S.PLAY_W+(width+baseGap)*2;
    const speed=dir*(48+(row.index%3)*4);
    const gapWeights=[.82,1.18,.94,1.32,.88,1.12,1.04,.90];

    let count=Math.max(4,Math.floor(cycleLength/(width+baseGap*1.35)));
    const makeSpacings=n=>{
      const weights=Array.from({length:n},(_,i)=>gapWeights[(i+row.index)%gapWeights.length]);
      const sum=weights.reduce((a,b)=>a+b,0);
      return weights.map(w=>cycleLength*w/sum);
    };
    let spacings=makeSpacings(count);
    while(count>4&&Math.min(...spacings)<width+baseGap*.45){
      count--;
      spacings=makeSpacings(count);
    }

    let x=cycleStart+(row.index%3)*Math.min(12,baseGap*.25);
    for(let i=0;i<count;i++){
      const c=this.add.container(x,row.y-2).setDepth(depth(this,row.y,38));
      c.add(this.add.ellipse(4,9,width*.84,clamp(S.ROW_H*.16,8,13),0x163c55,.25));
      const texture=`kitchen-board-${BOARD_FILES[(i+row.index)%BOARD_FILES.length]}`;
      if(exists(this,texture)){
        const img=this.add.image(0,0,texture),scale=width/Math.max(1,img.width||1);
        img.setScale(scale).setOrigin(.5,.58).setFlipX(dir<0&&i%2===1);c.add(img);
      }else{
        const g=this.add.graphics();g.fillStyle(0xa96c39,1);g.fillRoundedRect(-width*.5,-10,width,20,4);c.add(g);
      }
      c.__rowY=row.y;
      c.__float={vx:speed,width,hitWidth:width*.84,kind:'kitchen-board',stationary:false,left:S.PLAY_X,right:S.PLAY_X+S.PLAY_W,cycleStart,cycleLength};
      row.floaters.push(c);this.floaters.push(c);this.track(c);row.objects.push(c);
      this.tweens.add({targets:c,y:c.y+2.2,angle:dir>0?1.1:-1.1,duration:700+(i%4)*130,yoyo:true,repeat:-1,ease:'Sine.InOut'});
      x+=spacings[i];
    }
  };

  // Force the side frame on for Level 1 and remove any stale inline hiding.
  const syncSideFrame=kitchen=>{
    const frame=document.getElementById('kitchen-side-frame');
    if(!frame)return;
    frame.classList.toggle('force-show',Boolean(kitchen));
    frame.style.display=kitchen?'block':'none';
    frame.style.visibility=kitchen?'visible':'hidden';
    frame.style.opacity=kitchen?'1':'0';
  };

  const baseStartLevel=proto.startLevel;
  proto.startLevel=function(level,opt){
    const result=baseStartLevel.call(this,level,opt);
    syncSideFrame(this.selectedLevel===1);
    return result;
  };

  const baseOpenLevelSelect=proto.openLevelSelect;
  proto.openLevelSelect=function(...args){
    syncSideFrame(false);
    return baseOpenLevelSelect.apply(this,args);
  };
})();
