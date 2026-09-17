export type User={id:string;name:string;email:string;username?:string;avatar?:string;bio?:string}
export type Media={key:string;url:string}
export type Author={id:string;name:string;username?:string;avatar?:string}
export type Post={id:string;slug:string;title:string;excerpt:string;content:string;thumbnail?:Media;author?:Author;published_at?:string;created_at?:string}
export type Page<T>={items:T[];page:number;limit:number;total:number}
export type CaptureKind='idea'|'quote'|'task'
export type Capture={id:string;content:string;kind:CaptureKind;created_at:string}
export type AuthResult={access_token:string;refresh_token:string;user:User}
