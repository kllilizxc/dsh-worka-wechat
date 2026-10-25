import {useRoutes,type RouteObject} from 'react-router';
import {useNote} from '@dsh-workbench/react';
import View from './view-body';

export const routes = [{element:<View/>,children:[{index:true,element:null},{path:"chats/:chatId",element:null},{path:"sessions",element:null}]},{path:'*',element:<section role="alert">页面不存在，请返回便笺首页。</section>}] satisfies RouteObject[];
export default function RoutedView(){const {mode}=useNote();const page=useRoutes(routes);return mode==='compact'?<View/>:page;}
