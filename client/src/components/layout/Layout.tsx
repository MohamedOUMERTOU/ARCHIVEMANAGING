import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { Button, Layout, Menu } from "antd";
import React, { useContext, useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { getMenus } from "../../apis/SEApis";
import { Icons } from "../../core/SEIcons";
import { SEContext } from "../../context/userSEContext";
import { MenuItem } from "../../context/Types";

const { Header, Sider, Content } = Layout;
const { SubMenu } = Menu;



const SELayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [menuData, setMenuData] = useState<MenuItem[]>([]);
 
  useEffect(() => {
    fetchMenus();
  }, []);
  const context = useContext(SEContext);

  if (!context) {
    // Handle the case where context is not available
    return <div>Error: SEContext is not available</div>;
  }
  const { users, setUsers } = context;
 const { axes, setAxes}=context;


  const fetchMenus = async () => {
    try {
      const menus: MenuItem[] = await getMenus();
      setMenuData(menus);
      setAxes(menus);
    } catch (error) {
      console.error("Error fetching menus:", error);
    }
  };

  const renderMenuItems = (menuItems: MenuItem[], parentPath = "") => {
    return menuItems.map((menuItem) => {
      const currentPath = parentPath
        ? `${parentPath}/${menuItem.nom}`
        : menuItem.nom;

      if (menuItem.subMenus && menuItem.subMenus.length > 0) {
        return (
          <SubMenu
            key={menuItem.idMenu}
            title={menuItem.nom}
            icon={
              menuItem.icon ? React.createElement(Icons[menuItem.icon]) : null
            }
          >
            {renderMenuItems(menuItem.subMenus, currentPath)}
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
          <Link to={currentPath}>{menuItem.nom}</Link>
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
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default SELayout;
