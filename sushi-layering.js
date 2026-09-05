(() => {
  const S=window.SS, proto=window.SushiScene.prototype;
  const FG_BASE=10000;
  const depthFor=(y,offset=0)=>FG_BASE+Math.round((Number(y)||0)*10)+offset;
  proto.depthForY=depthFor;

  proto.planLandObstacles=function(){
    this.blockedCells=new Set();
    const rng=S.rngFor(this.selectedLevel*911+73);
    for(const row of this.rows)row.obstacles=[];

    const reservedFor=row=>{
      const store=this.storePlans?.find(sp=>Math.abs(row.index-sp.centerRow)<=3);
      const cols=store&&this.pathColumnsForStore?this.pathColumnsForStore(store.rowStart,store.rowEnd):[S.START_COL-1,S.START_COL,S.START_COL+1];
      return cols.filter(c=>c>=0&&c<S.COLS);
    };

    const add=(row,kind,col,span)=>{
      const cells=[];
      for(let d=0;d<span;d++){
        const cc=col+d;
        this.blockedCells.add(`${row.index}:${cc}`);
        cells.push(cc);
      }
      row.obstacles.push({kind,col,span,cells});
    };

    // Keep both banks beside every river completely open so a lily pad or log
    // always has an unobstructed exit onto land.
    const touchesWater=i=>this.rows[i-1]?.type==='water'||this.rows[i+1]?.type==='water';
    const landRows=this.rows.filter((row,i)=>row?.type==='safe'&&!touchesWater(i)&&(this.rows[i-1]?.type==='road'||this.rows[i+1]?.type==='road'));

    for(const row of landRows){
      const reserved=reservedFor(row);
      const conflicts=(col,span)=>{
        for(let d=0;d<span;d++){
          const cc=col+d;
          if(cc<0||cc>=S.COLS||this.blockedCells.has(`${row.index}:${cc}`)||reserved.some(rc=>Math.abs(rc-cc)<=1))return true;
        }
        return false;
      };

      // Half the previous density: two buildings on normal screens, four wide.
      const buildingTarget=S.W>=900?4:2;
      let tries=0;
      while(row.obstacles.filter(o=>o.kind==='building').length<buildingTarget&&tries++<120){
        const existing=row.obstacles.filter(o=>o.kind==='building').length;
        const span=rng()<.72?1:2;
        let col=existing%2===0
          ?Math.floor(rng()*Math.max(1,Math.floor(S.COLS*.33)))
          :Math.max(0,S.COLS-span-Math.floor(rng()*Math.max(1,Math.floor(S.COLS*.33))));
        if(conflicts(col,span)){
          const choices=[];
          for(let c=0;c<=S.COLS-span;c++)if(!conflicts(c,span))choices.push(c);
          if(!choices.length)continue;
          col=choices[Math.floor(rng()*choices.length)];
        }
        add(row,'building',col,span);
      }

      const treeTarget=S.W>=900?6:4;
      tries=0;
      while(row.obstacles.filter(o=>o.kind==='tree').length<treeTarget&&tries++<120){
        const col=Math.floor(rng()*S.COLS);
        if(conflicts(col,1)||row.obstacles.some(o=>Math.abs(o.col-col)<=1))continue;
        add(row,'tree',col,1);
      }
    }

    for(let i=0;i<this.rows.length;i++){
      const row=this.rows[i];
      if(row?.type!=='safe'||landRows.includes(row)||touchesWater(i)||row.index<2||row.index>this.goalRow-2)continue;
      const reserved=reservedFor(row);
      let tries=0;
      while(row.obstacles.filter(o=>o.kind==='tree').length<(S.W>=900?5:3)&&tries++<80){
        const col=Math.floor(rng()*S.COLS);
        if(reserved.some(rc=>Math.abs(rc-col)<=1)||this.blockedCells.has(`${row.index}:${col}`)||row.obstacles.some(o=>Math.abs(o.col-col)<=1))continue;
        add(row,'tree',col,1);
      }
    }
  };

  proto.renderLandObstacles=function(row){
    for(const o of row.obstacles||[]){
      const x=this.colX(o.col)+(o.span-1)*S.CELL_W*.5;
      const d=depthFor(row.y,o.kind==='building'?34:28);
      const obj=o.kind==='building'?this.createBlockBuilding(x,row.y-8,o.span*S.CELL_W*.88,d):this.createTree(x,row.y-4,d);
      obj?.setDepth?.(d);
      if(obj)obj.__rowY=row.y;
    }
  };

  const baseCreateImageVehicle=proto.createImageVehicle;
  if(baseCreateImageVehicle){
    proto.createImageVehicle=function(x,y,targetW,dir,key){
      const vehicle=baseCreateImageVehicle.call(this,x,y,targetW,dir,key);
      vehicle?.setDepth?.(depthFor(y,42));
      if(vehicle)vehicle.__rowY=y;
      return vehicle;
    };
  }

  const baseCreateVehicle=proto.createVehicle;
  proto.createVehicle=function(x,y,w,h,truck,dir){
    const vehicle=baseCreateVehicle.call(this,x,y,w,h,truck,dir);
    vehicle?.setDepth?.(depthFor(y,42));
    if(vehicle)vehicle.__rowY=y;
    return vehicle;
  };

  const baseCreatePickup=proto.createPickup;
  proto.createPickup=function(x,y,item,zoneW){
    const pickup=baseCreatePickup.call(this,x,y,item,zoneW);
    pickup?.setDepth?.(depthFor(y,50));
    if(pickup)pickup.__rowY=y;
    return pickup;
  };

  const baseRestaurant=proto.createRestaurant;
  proto.createRestaurant=function(x,y,d){
    const obj=baseRestaurant.call(this,x,y,d);
    obj?.setDepth?.(depthFor(y,32));
    if(obj)obj.__rowY=y;
    return obj;
  };

  const baseTrain=proto.createTrain;
  if(baseTrain){
    proto.createTrain=function(row,dir){
      const obj=baseTrain.call(this,row,dir);
      obj?.setDepth?.(depthFor(row.y,60));
      if(obj)obj.__rowY=row.y;
      return obj;
    };
  }

  proto.checkTrafficCollision=function(){
    if(this.runEnded||!this.player||this.isMoving)return;
    const row=this.rows[this.playerRow];
    if(row?.type!=='road')return;
    for(const vehicle of row.vehicles||[]){
      const meta=vehicle?.__traffic;
      if(!vehicle?.active||vehicle.visible===false||vehicle.alpha<=0||!meta)continue;
      const hitWidth=meta.hitWidth||Math.max(20,(meta.width||40)*.48);
      const visuallyNear=vehicle.x>=S.PLAY_X-hitWidth&&vehicle.x<=S.PLAY_X+S.PLAY_W+hitWidth;
      if(!visuallyNear)continue;
      if(Math.abs(vehicle.x-this.player.x)<=hitWidth*.5){
        return this.failRun('TRAFFIC HIT','A visible vehicle hit the chef. Read the lane gap, then move.','traffic');
      }
    }
  };

  const baseUpdate=proto.update;
  proto.update=function(time,delta){
    baseUpdate.call(this,time,delta);
    if(this.player?.active)this.player.setDepth(depthFor(this.player.y,48));
    for(const v of this.vehicles||[])if(v?.active)v.setDepth(depthFor(v.__rowY??v.y,42));
    for(const f of this.floaters||[])if(f?.active)f.setDepth(depthFor(f.__rowY??f.y,36));
    for(const p of this.pickups||[])if(p?.active)p.setDepth(depthFor(p.__rowY??p.y,50));
    for(const t of this.trains||[])if(t?.active)t.setDepth(depthFor(t.__rowY??t.y,60));
  };
})();