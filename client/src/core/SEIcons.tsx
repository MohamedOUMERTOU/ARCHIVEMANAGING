// src/core/SEIcons.tsx

import {
  AppstoreAddOutlined,
  ClusterOutlined,
  FileDoneOutlined,
  FileSearchOutlined,
  FolderOutlined,
  GoldOutlined,
  IdcardOutlined,
  SettingOutlined,
  UserOutlined,
  FileOutlined
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
  FileOutlined:(props:any) => <FileOutlined {...props}/>
};
