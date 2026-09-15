/* Explicit PC boot hook; not loaded by production until the server contract is deployed. */
(function(w){
 'use strict';
 let stop=null,actor=null;
 function disconnect(){if(stop)stop();stop=null;actor=null;}
 function connect(){
  const profile=w.Phase1?.profile;if(!profile)return disconnect();
  if(actor===profile.auth_uid&&stop)return;
  disconnect();
  if(!w.ManagerRequestClient||!w.PCManagerRequests)throw Error('MANAGER_REQUEST_MODULE_MISSING');
  const api=w.ManagerRequestClient.createClient(w.Phase1);
  const stopRequests=w.PCManagerRequests.install(w,api);
  const stopSummary=w.PCManagerRequestSummary?.install(api);
  stop=()=>{stopRequests();if(stopSummary)stopSummary();};actor=profile.auth_uid;
 }
 w.addEventListener('phase1:identity-cleared',disconnect);
 w.addEventListener('phase1:profile',connect);
 w.PCManagerRequestConnection={connect,disconnect};
 if(w.Phase1?.profile)connect();
})(window);
