(() => {
  const S=window.SS, proto=window.SushiScene.prototype;
  const mod=(n,m)=>((n%m)+m)%m;

  // Successful arrival copy: reaching the restaurant with the minimum menu
  // should read as a clear success, not just a generic "restaurant open" state.
  const baseShowResult=proto.showResult;
  proto.showResult=function(success,title,body,revenue){
    if(success){
      title='ENOUGH INGREDIENTS!';
      body=this.menuRatio?.()===1
        ?'You have enough ingredients. Your restaurant can now open with the full menu. Great run!'
        :'You have enough ingredients. Your restaurant can now open. The more shops you visit, the more complete your menu can be.';
    }
    return baseShowResult.call(this,success,title,body,revenue);
  };

  const baseStartLevel=proto.startLevel;
  proto.startLevel=function(level,opt){
    this._trafficCrash=null;
    return baseStartLevel.call(this,level,opt);
  };

  proto.beginTrafficCrash=function(row,hitVehicle){
    if(!row||!hitVehicle?.__traffic)return;
    const dir=Math.sign(hitVehicle.__traffic.vx)||1;
    const stopped=new Set([hitVehicle]);

    // Stop the striking car and every car physically behind it in the same
    // lane. Cars already ahead are allowed to continue out of the scene.
    for(const vehicle of row.vehicles||[]){
      if(vehicle===hitVehicle||!vehicle?.__traffic)continue;
      const relative=(vehicle.x-hitVehicle.x)*dir;
      if(relative<0)stopped.add(vehicle);
    }

    this._trafficCrash={rowIndex:row.index,hitVehicle,stopped,dir};

    // The chef is under the car after impact, so remove the character and its
    // shadow immediately instead of leaving the sprite visible through the car.
    this.player?.setVisible?.(false);
    this.playerArt?.setVisible?.(false);
    this.playerShadow?.setVisible?.(false);
  };

  // Replace the layering collision hook so the exact visible vehicle that hit
  // the chef is the one that starts the stopped-lane queue.
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
        this.beginTrafficCrash(row,vehicle);
        return this.failRun('TRAFFIC HIT','A vehicle hit the chef. The lane has stopped behind the crash.','traffic');
      }
    }
  };

  proto.updateCrashTraffic=function(dt){
    const crash=this._trafficCrash;
    if(!crash)return;

    for(const row of this.rows||[]){
      if(row?.type!=='road')continue;
      const crashedLane=row.index===crash.rowIndex;

      for(const vehicle of row.vehicles||[]){
        if(!vehicle?.active||!vehicle.__traffic)continue;
        const meta=vehicle.__traffic;

        if(crashedLane){
          if(crash.stopped.has(vehicle))continue;
          // Cars already ahead of the impact keep going, but do not wrap back
          // around behind the stopped queue during the death beat.
          vehicle.x+=meta.vx*dt;
          continue;
        }

        // Traffic on unrelated lanes continues normally during the impact beat.
        const next=vehicle.x+meta.vx*dt;
        vehicle.x=meta.cycleStart+mod(next-meta.cycleStart,meta.cycleLength);
      }
    }
  };

  const baseUpdate=proto.update;
  proto.update=function(time,delta){
    baseUpdate.call(this,time,delta);
    if(this.runEnded&&this._trafficCrash){
      this.updateCrashTraffic(Math.min(delta,40)/1000);
    }
  };
})();
