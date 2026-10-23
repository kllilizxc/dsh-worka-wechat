import {defineNoteView} from '@dsh-workbench/react';
export default defineNoteView({prerequisites:{configurationInView:true},compact:()=>import('./view-body'),expanded:()=>import('./view-body')});
