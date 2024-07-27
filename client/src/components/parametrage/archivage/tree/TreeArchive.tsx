import React, { FC } from 'react'
import SEDirectoryTree from '../../../../core/SEDirectoryTree'

const TreeArchive :FC= () => {

  const onSelect = (keys: React.Key[], info: any) => {
    console.log('Selected Keys:', keys, 'Info:', info);
  };

  const onExpand = (keys: React.Key[], info: any) => {
    console.log('Expanded Keys:', keys, 'Info:', info);
  };

  const onEdit = (key: React.Key) => {
    console.log('Edit Node with Key:', key);
    // Implement edit functionality
  };

  const onDelete = (key: React.Key) => {
    console.log('Delete Node with Key:', key);
    // Implement delete functionality
  };

  const treeData = [
    {
      title: 'parent 0',
      key: '0-0',
      children: [
        { title: 'parent 0-0', key: '0-0-0'  },
        { title: 'parent 0-1', key: '0-0-1' },
      ],
    },
    {
      title: 'parent 1',
      key: '0-1',
      children: [
        { title: 'parent 1-0', key: '0-1-0' },
        { title: 'parent 1-1', key: '0-1-1' },
      ],
    },
  ];

  return (
    <SEDirectoryTree
      treeData={treeData}
      onSelect={onSelect}
      onExpand={onExpand}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
};

export default TreeArchive
