import React from 'react';
import { Tree, Dropdown, Menu, Button } from 'antd';
import type { TreeDataNode } from 'antd';
import { MoreOutlined } from '@ant-design/icons';

type DirectoryTreeProps = {
  treeData: TreeDataNode[];
  onSelect?: (keys: React.Key[], info: any) => void;
  onExpand?: (keys: React.Key[], info: any) => void;
  onEdit?: (key: React.Key) => void;
  onDelete?: (key: React.Key) => void;
  className?: string;
};

const { DirectoryTree } = Tree;

const SEDirectoryTree: React.FC<DirectoryTreeProps> = ({
  treeData,
  onSelect,
  onExpand,
  onEdit,
  onDelete,
  className = '',
  ...restProps
}) => {
  const handleMenuClick = (key: React.Key, action: 'edit' | 'delete') => {
    if (action === 'edit' && onEdit) {
      onEdit(key);
    } else if (action === 'delete' && onDelete) {
      onDelete(key);
    }
  };

  // Function to render the title with icon and action buttons
  const renderTreeNodeTitle = (node: TreeDataNode): React.ReactNode => (
    <div style={{ display: 'inline', alignItems: 'center' }}>
      {/* Render the icon here if needed */}
      <span style={{ flexGrow: 1 }}>{node.title as React.ReactNode}</span>
      <Dropdown
        overlay={
          <Menu>
            <Menu.Item key="edit" onClick={() => handleMenuClick(node.key, 'edit')}>
              Edit
            </Menu.Item>
            <Menu.Item key="delete" onClick={() => handleMenuClick(node.key, 'delete')}>
              Delete
            </Menu.Item>
          </Menu>
        }
        trigger={['click']}
        placement="bottomRight"
      >
        <Button
          icon={<MoreOutlined />}
          style={{ marginLeft: 2 }} // Space between title and button
          size="small"
        />
      </Dropdown>
    </div>
  );

  // Transform the treeData to include ReactNode for the title
  const transformTreeData = (nodes: TreeDataNode[]): TreeDataNode[] =>
    nodes.map((node) => ({
      ...node,
      title: renderTreeNodeTitle(node),
      children: node.children ? transformTreeData(node.children) : undefined,
    }));

  return (
    <DirectoryTree
      className={`se-directory-tree ${className}`}
      multiple
      defaultExpandAll
      onSelect={onSelect}
      onExpand={onExpand}
      treeData={transformTreeData(treeData)}
      {...restProps} // Spread remaining props to Ant Design DirectoryTree component
    />
  );
};

export default SEDirectoryTree;
