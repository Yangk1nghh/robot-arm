import test from 'node:test';import assert from 'node:assert/strict';
import {advanceAngle,stickVelocity} from '../controller/joystick.js';
import {createLocalAxes} from '../controller/optimistic.js';
test('equal joystick speed at 30, 60 and 120 Hz, including fractional movements',()=>{
 const angles=[30,60,120].map(hz=>{let angle=0;for(let n=0;n<hz;n++)angle=advanceAngle(angle,1,1/hz,-180,180);return angle});
 for(const a of angles)assert.ok(Math.abs(a-42)<1e-9);
 assert.ok(advanceAngle(0,.2,1/60,-180,180)>0);
});
test('deadzone, limits and background frame gap',()=>{
 assert.equal(stickVelocity(.1),0);assert.equal(advanceAngle(179,1,1, -180,180),180);
 assert.equal(advanceAngle(0,1,10,-180,180),2.1);
});
test('old acknowledgement cannot overwrite newer local input',()=>{
 const l=createLocalAxes();const a=l.set(0,12);const b=l.set(0,18);
 l.acknowledge(0,a);assert.deepEqual(l.merge([12,0]),[18,0]);
 l.acknowledge(0,b);assert.deepEqual(l.merge([18,0]),[18,0]);assert.equal(l.busy(),false);
});
test('held axes survive server polls and acknowledged samples; other axes still sync',()=>{
 const l=createLocalAxes();l.begin(0,2.5);const ticket=l.set(0,5.1);l.acknowledge(0,ticket);
 assert.deepEqual(l.merge([2,10]),[5.1,10]);l.end(0);assert.deepEqual(l.merge([6,11]),[6,11]);
});
test('release preserves unacknowledged final position and failure drops ownership',()=>{
 const l=createLocalAxes();l.begin(1,1);l.set(1,9.3);l.end(1);assert.deepEqual(l.merge([0,1]),[0,9.3]);
 l.clear();assert.equal(l.busy(),false);assert.deepEqual(l.merge([0,1]),[0,1]);
});
