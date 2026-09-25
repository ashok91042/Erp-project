export const ROLES = ['principal','teacher','parent'];
export function getSession(){if(typeof window==='undefined')return null;try{const role=sessionStorage.getItem('erp_role');const user=JSON.parse(sessionStorage.getItem('erp_user')||'null');return role?{role,user}:null}catch{return null}}
export function signOut(){if(typeof window!=='undefined')sessionStorage.clear()}
