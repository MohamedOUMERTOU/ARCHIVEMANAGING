// src/core/SEIcons.tsx
import React from "react";
import {
  AppstoreAddOutlined,
  ClusterOutlined,
  FileDoneOutlined,
  FileOutlined,
  FileSearchOutlined,
  FolderOutlined,
  GoldOutlined,
  IdcardOutlined,
  PlusOutlined,
  SettingOutlined,
  UserOutlined,
  CloseOutlined,
  CloseSquareOutlined
} from "@ant-design/icons";
export const Icons = {
  SettingOutlined: (props: any) => <SettingOutlined {...props} />,
  FileDoneOutlined: (props: any) => <FileDoneOutlined {...props} />,
  UserOutlined: (props: any) => <UserOutlined {...props} />,
  GoldOutlined: (props: any) => <GoldOutlined {...props} />,
  FileSearchOutlined: (props: any) => <FileSearchOutlined {...props} />,
  FolderOutlined: (props: any) => <FolderOutlined {...props} />,
  ClusterOutlined: (props: any) => <ClusterOutlined {...props} />,
  AppstoreAddOutlined:(props:any) => <AppstoreAddOutlined {...props}/>,
  IdcardOutlined:(props:any) => <IdcardOutlined {...props}/>,
  FileOutlined:(props:any) => <FileOutlined {...props}/>,
  PlusOutlined :(props:any) => <PlusOutlined  {...props}/>,
  CloseSquareOutlined :(props:any) => <CloseSquareOutlined  {...props}/>,
  CloseOutlined :(props:any) => <CloseOutlined  {...props}/>
};
