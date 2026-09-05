(() => {
  const S=window.SS, proto=window.SushiScene.prototype;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const depth=(scene,y,o=0)=>scene.depthForY?scene.depthForY(y,o):10000+Math.round((Number(y)||0)*10)+o;

  const addRowRect=(scene,row,x,y,w,h,color,alpha,z)=>{
    const obj=scene.track(scene.add.rectangle(x,y,w,h,color,alpha).setDepth(z));
    row?.objects?.push(obj);
    return obj;
  };

  // Replace the plain light-grey kitchenSafe strips with a warm, light wood
  // floor. Mechanic rows keep their existing tile textures; this only changes
  // the neutral walking floor between stations.
  const previousRenderKitchenRow=proto.renderKitchenRow;
  proto.renderKitchenRow=function(row){
    if(!this._kitchenMode||row.type!=='kitchenSafe'){
      return previousRenderKitchenRow.call(this,row);
    }

    const center=S.PLAY_X+S.PLAY_W*.5;
    const z=depth(this,row.y,-520);
    addRowRect(this,row,center,row.y+4,S.PLAY_W+4,S.ROW_H,0x9a7048,1,z);
    addRowRect(this,row,center,row.y,S.PLAY_W+4,S.ROW_H-6,0xd2aa76,1,z+1);

    // Subtle plank variation and seams so it reads as a sushi-restaurant wood
    // floor rather than a single flat brown rectangle.
    const plankW=clamp(S.CELL_W*1.45,58,92);
    let i=0;
    for(let x=S.PLAY_X;x<S.PLAY_X+S.PLAY_W+plankW;x+=plankW,i++){
      const tone=(i+row.index)%3===0?0xd8b582:(i+row.index)%3===1?0xcda16d:0xd4ab77;
      addRowRect(this,row,x+plankW*.5,row.y,plankW-1,S.ROW_H-8,tone,.62,z+2);
      addRowRect(this,row,x,row.y,2,S.ROW_H-10,0x8f653f,.28,z+3);
    }
    addRowRect(this,row,center,row.y-S.ROW_H*.43,S.PLAY_W+4,2,0xf1d0a2,.36,z+4);
    addRowRect(this,row,center,row.y+S.ROW_H*.43,S.PLAY_W+4,2,0x8b603d,.24,z+4);
  };

  const collectIngredientItem=(scene,item)=>{
    const meta=item?.__kitchenIngredient;
    if(!item?.active||item.visible===false||!meta||meta.collected)return false;

    meta.collected=true;
    scene.kitchenIngredientInventory?.push(meta.file||1);
    scene.menuCollected.kitchenChoice=(scene.menuCollected.kitchenChoice||0)+1;
    scene.score+=meta.points||12;
    scene.playSfx?.('pickup');

    const label=scene.track(scene.add.text(item.x,item.y-36,'INGREDIENT +12',{
      fontFamily:'Inter,system-ui,sans-serif',
      fontSize:'12px',
      fontStyle:'900',
      color:'#17212a',
      backgroundColor:'#f8f858',
      padding:{x:7,y:4}
    }).setOrigin(.5).setDepth(scene.depthForY?scene.depthForY(item.y,110):140));

    scene.tweens.add({
      targets:item,
      y:item.y-16,
      scaleX:item.scaleX*1.12,
      scaleY:item.scaleY*1.12,
      alpha:0,
      duration:260,
      ease:'Quad.Out',
      onComplete:()=>item.setVisible(false)
    });
    scene.tweens.add({targets:label,y:label.y-18,alpha:0,duration:520,onComplete:()=>label.destroy()});
    return true;
  };

  // Collect ingredients crossed by the chef's actual horizontal movement, not
  // just the ingredient under the final landing position. This prevents a
  // left/right hop from visually passing through food without picking it up.
  const collectAlongHorizontalPath=(scene,rowIndex,x0,x1)=>{
    const row=scene.rows?.[rowIndex];
    if(!row||row.type!=='kitchenIngredient')return;
    const tolerance=clamp(S.CELL_W*.10,5,9);
    const left=Math.min(x0,x1)-tolerance;
    const right=Math.max(x0,x1)+tolerance;
    let changed=false;

    for(const group of scene.kitchenIngredientGroups||[]){
      if(group.rowIndex!==rowIndex)continue;
      const items=(group.items||[]).slice().sort((a,b)=>x1>=x0?a.x-b.x:b.x-a.x);
      for(const item of items){
        if(item.x<left||item.x>right)continue;
        changed=collectIngredientItem(scene,item)||changed;
      }
    }
    if(changed)scene.updateHud?.();
  };

  const previousStartLevel=proto.startLevel;
  proto.startLevel=function(level,opt){
    const result=previousStartLevel.call(this,level,opt);
    this._kitchenIngredientSweepX=this.player?.x??null;
    this._kitchenIngredientSweepRow=this.playerRow;
    return result;
  };

  const previousUpdate=proto.update;
  proto.update=function(time,delta){
    const beforeX=this.player?.x;
    const beforeRow=this.playerRow;
    const result=previousUpdate.call(this,time,delta);

    if(this._kitchenMode&&this.player&&!this.runEnded){
      const previousX=Number.isFinite(this._kitchenIngredientSweepX)?this._kitchenIngredientSweepX:beforeX;
      const previousRow=Number.isInteger(this._kitchenIngredientSweepRow)?this._kitchenIngredientSweepRow:beforeRow;
      const currentX=this.player.x;
      const currentRow=this.playerRow;

      if(previousRow===currentRow&&Number.isFinite(previousX)&&Math.abs(currentX-previousX)>.01){
        collectAlongHorizontalPath(this,currentRow,previousX,currentX);
      }
      this._kitchenIngredientSweepX=currentX;
      this._kitchenIngredientSweepRow=currentRow;
    }
    return result;
  };
})();
