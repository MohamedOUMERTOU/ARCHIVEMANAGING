import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { Button, Layout, Menu } from "antd";
import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Icons } from "../../core/SEIcons";

import { getMenus } from "../../apis/SEApis";
import SEgrid from "../../core/SEgrid";

const { Header, Sider, Content } = Layout;
const { SubMenu } = Menu;

type IconKeys = keyof typeof Icons;

interface MenuItem {
  idMenu: number;
  icon?: IconKeys;
  nom: string;
  subMenus?: MenuItem[];
}

const SELayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [menuData, setMenuData] = useState<MenuItem[]>([]);
  const [rowData, setRowData] = useState([
    { key: "1", make: "Tesla", model: "Model Y", price: 64950, electric: true },
    {
      key: "2",
      make: "Ford",
      model: "F-Series",
      price: 33850,
      electric: false,
    },
    {
      key: "3",
      make: "Toyota",
      model: "Corolla",
      price: 29600,
      electric: false,
    },
  ]);

  const columns = [
    {
      title: "Make",
      dataIndex: "make",
      key: "make",
    },
    {
      title: "Model",
      dataIndex: "model",
      key: "model",
    },
    {
      title: "Price",
      dataIndex: "price",
      key: "price",
    },
    {
      title: "Electric",
      dataIndex: "electric",
      key: "electric",
      render: (text: boolean) => (text ? "Yes" : "No"),
    },
  ];

  useEffect(() => {
    fetchMenus();
  }, []);

  const fetchMenus = async () => {
    try {
      const menus: MenuItem[] = await getMenus();
      setMenuData(menus);
    } catch (error) {
      console.error("Error fetching menus:", error);
    }
  };

  const renderMenuItems = (menuItems: MenuItem[]) => {
    return menuItems.map((menuItem) => {
      if (menuItem.subMenus && menuItem.subMenus.length > 0) {
        return (
          <SubMenu
            key={menuItem.idMenu}
            title={menuItem.nom}
            icon={
              menuItem.icon ? React.createElement(Icons[menuItem.icon]) : null
            }
          >
            {renderMenuItems(menuItem.subMenus)}
          </SubMenu>
        );
      }
      return (
        <Menu.Item
          key={menuItem.idMenu}
          icon={
            menuItem.icon ? React.createElement(Icons[menuItem.icon]) : null
          }
        >
          {menuItem.nom}
        </Menu.Item>
      );
    });
  };

  const getTopLevelMenus = (menuItems: MenuItem[]): MenuItem[] => {
    // Collect all submenu ids
    const subMenuIds = new Set<number>();
    menuItems.forEach((item) => {
      item.subMenus?.forEach((subMenu) => subMenuIds.add(subMenu.idMenu));
    });

    // Filter out menu items that are submenus
    return menuItems.filter((item) => !subMenuIds.has(item.idMenu));
  };

  return (
    <Layout>
      <Sider trigger={null} collapsible collapsed={collapsed}>
        <div className="demo-logo-vertical" />
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={["1"]}
          style={{ marginTop: "20px" }}
        >
          {renderMenuItems(getTopLevelMenus(menuData))}
        </Menu>
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: "#fff" }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: "16px",
              width: 64,
              height: 64,
            }}
          />
        </Header>
        <Content
          style={{
            margin: "24px 16px",
            padding: 24,
            minHeight: 280,
            background: "#fff",
            borderRadius: "8px",
          }}
        >
          <SEgrid
            data={rowData}
            columns={columns}
            onRow={(record) => ({
              onClick: () => alert('test'),
            })}
          />
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default SELayout;
