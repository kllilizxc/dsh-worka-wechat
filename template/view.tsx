import {defineNoteView} from '@dsh-workbench/react';
export default defineNoteView({prerequisites:{configurationInView:true},compact:()=>import('./routes'),expanded:()=>import('./routes')});
