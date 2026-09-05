(() => {
  const S=window.SS, proto=window.SushiScene.prototype;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const depth=(scene,y,o=0)=>scene.depthForY?scene.depthForY(y,o):10000+Math.round((Number(y)||0)*10)+o;
  const exists=(scene,key)=>scene.textures?.exists?.(key);
  const INGREDIENT_FILES=[1,2,3,4,5,6];
  const PLATE_FILES=[1,2,3,4];
  const PLATE_POINTS={1:5,2:10,3:20,4:35};
  const POT_FILES=[1,2,3];

  const chooseCenters=(centers,count,left,right)=>{
    if(Array.isArray(centers)&&centers.length>=count){
      if(count===1)return [centers[Math.floor(centers.length/2)]];
      const out=[];
      for(let i=0;i<count;i++)out.push(centers[Math.round(i*(centers.length-1)/(count-1))]);
      return out;
    }
    const out=[];
    for(let i=0;i<count;i++)out.push(left+(i+.5)*(right-left)/count);
    return out;
  };

  const nearestCol=(scene,x)=>{
    let best=0,dist=Infinity;
    for(let col=0;col<S.COLS;col++){
      const d=Math.abs(scene.colX(col)-x);
      if(d<dist){dist=d;best=col;}
    }
    return best;
  };

  const addFullTileBand=(scene,row,texture,under=0x34393f)=>{
    const z=depth(scene,row.y,-520),center=S.PLAY_X+S.PLAY_W*.5;
    const bg=scene.track(scene.add.rectangle(center,row.y,S.PLAY_W+4,S.ROW_H+2,under,1).setDepth(z));
    row.objects.push(bg);
    row.__kitchenTileCenters=[];
    if(!exists(scene,texture))return;

    const src=scene.textures.get(texture).getSourceImage();
    const sourceH=Math.max(1,src.height||1),sourceW=Math.max(1,src.width||1);
    // Previous kitchen pass rendered tile art at roughly .84 row-height.
    // Double that texture scale, but clip it to exactly one logical row so the
    // strip is completely filled without bleeding into neighboring mechanics.
    const visualTileH=S.ROW_H*1.68;
    const tileScale=visualTileH/sourceH;
    const tileW=Math.max(18,sourceW*tileScale);
    const band=scene.track(scene.add.tileSprite(center,row.y,S.PLAY_W+4,S.ROW_H+2,texture).setDepth(z+2));
    band.tileScaleX=tileScale;
    band.tileScaleY=tileScale;
    band.tilePositionX=0;
    band.tilePositionY=(visualTileH-(S.ROW_H+2))*.5;
    band.__rowY=row.y;
    row.objects.push(band);

    // Record visual tile centers so pickups/obstacles can sit in the middle of
    // the repeated tile cells instead of floating between them.
    const first=S.PLAY_X+tileW*.5;
    for(let x=first;x<S.PLAY_X+S.PLAY_W+tileW*.5;x+=tileW)row.__kitchenTileCenters.push(x);
  };

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
        // Exactly about 2x the old .62-row target size.
        const targetH=clamp(S.ROW_H*1.24,68,92);
        item.setScale(targetH/Math.max(1,item.height||1)).setOrigin(.5,.58);
      }else item=this.add.circle(x,y,18,0xf8f858,1).setDepth(depth(this,y,52));
      const col=nearestCol(this,x);
      item.__rowY=row.y;
      item.__kitchenIngredient={file,col,group,points:12};
      this.track(item);row.objects.push(item);group.items.push(item);
    });
  };

  proto.buildKitchenPlateRow=function(row){
    const count=S.W>=720?4:3,left=S.PLAY_X,right=S.PLAY_X+S.PLAY_W;
    const xs=chooseCenters(row.__kitchenTileCenters,count,left,right);
    const offset=row.index%PLATE_FILES.length;
    for(let i=0;i<count;i++){
      const file=PLATE_FILES[(i+offset)%PLATE_FILES.length],texture=`kitchen-plate-${file}`,x=xs[i],y=row.y-2;
      let plate;
      if(exists(this,texture)){
        plate=this.add.image(x,y,texture).setDepth(depth(this,y,50));
        const targetH=clamp(S.ROW_H*.72,38,52);
        plate.setScale(targetH/Math.max(1,plate.height||1)).setOrigin(.5,.6);
      }else plate=this.add.ellipse(x,y,44,20,0xeffae8,1).setDepth(depth(this,y,50));
      plate.__rowY=row.y;
      plate.__kitchenPlate={file,points:PLATE_POINTS[file]||5,collected:false,rowIndex:row.index,hitWidth:clamp(S.CELL_W*.9,40,64)};
      this.track(plate);row.objects.push(plate);this.kitchenPlates.push(plate);
    }
  };

  proto.buildKitchenPots=function(row){
    const logical=row.index%2?[1,Math.floor(S.COLS/2),S.COLS-2]:[2,Math.floor(S.COLS/2)+1,S.COLS-3];
    const centers=row.__kitchenTileCenters||[];
    const used=new Set();
    logical.forEach((rawCol,i)=>{
      const col=clamp(rawCol,0,S.COLS-1);if(used.has(col))return;used.add(col);
      const targetX=this.colX(col);
      const x=centers.length?centers.reduce((a,b)=>Math.abs(b-targetX)<Math.abs(a-targetX)?b:a,centers[0]):targetX;
      const file=POT_FILES[(i+row.index)%POT_FILES.length],texture=`kitchen-pot-${file}`,y=row.y-3;
      let pot;
      if(exists(this,texture)){
        pot=this.add.image(x,y,texture).setDepth(depth(this,y,56));
        pot.setScale(clamp(S.ROW_H*.82,44,60)/Math.max(1,pot.height||1)).setOrigin(.5,.68);
      }else pot=this.add.circle(x,y,20,0x24262d,1).setDepth(depth(this,y,56));
      pot.__rowY=row.y;pot.__kitchenHotPot={row:row.index,col};
      this.track(pot);row.objects.push(pot);this.kitchenPots.push(pot);this.kitchenHotPotCells.add(`${row.index}:${col}`);
    });
  };

  const baseRenderKitchenRow=proto.renderKitchenRow;
  proto.renderKitchenRow=function(row){
    if(row.type==='kitchenIngredient'){
      addFullTileBand(this,row,'kitchen-tile-2',0x554b40);
      this.buildKitchenIngredientStation(row);return;
    }
    if(row.type==='kitchenPlate'){
      addFullTileBand(this,row,'kitchen-tile-3',0x42474e);
      this.buildKitchenPlateRow(row);return;
    }
    if(row.type==='kitchenPots'){
      addFullTileBand(this,row,'kitchen-tile-1',0x292d31);
      this.buildKitchenPots(row);return;
    }
    if(row.type==='kitchenFlying'){
      addFullTileBand(this,row,'kitchen-tile-2',0x3c4146);
      this.buildKitchenFlyingSushi(row);return;
    }
    return baseRenderKitchenRow.call(this,row);
  };

  const syncSideFrame=kitchen=>{
    const frame=document.getElementById('kitchen-side-frame');
    if(!frame)return;
    frame.classList.toggle('force-show',Boolean(kitchen));
    frame.style.display=kitchen?'block':'none';
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