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
  const onCreate = (key: React.Key) => {
    console.log('Delete Node with Key:', key);
    // Implement delete functionality
  };

  const treeData = [
    {
      title: 'Archivage',
      key: '0-0',
      children: [

        {
          title: 'Salle I',
          key: '0-1',
          children: [
            { title: 'Reyonnage 1', key: '0-1-0',
              children: [
              { title: '2024/2023', key: '0-1-0-0' ,isLeaf: false},
              { title: '2022/2023', key: '0-1-0-1' ,isLeaf: false},
            ] ,isLeaf: false },
            { title: 'Reyonnage 2', key: '0-1-1' ,
              children: [
                { title: '2024/2023', key: '0-1-1-0',isLeaf: false },
                { title: '2022/2023', key: '0-1-1-1',isLeaf: false },
              ],isLeaf: false
            },

          ],
        } ,
        {
          title: 'Salle II',
          key: '0-2',
          children: [
            {
              title: 'Reyonnage 1', key: '0-2-0',
              children: [
                { title: '2024/2023', key: '0-2-0-0', isLeaf: false },
                { title: '2022/2023', key: '0-2-0-1', isLeaf: false },
              ], isLeaf: false
            },
            {
              title: 'Reyonnage 2', key: '0-2-1',
              children: [
                { title: '2024/2023', key: '0-2-1-0', isLeaf: false },
                { title: '2022/2023', key: '0-2-1-1', isLeaf: false },
              ], isLeaf: false
            },
          ],
        }
        
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
      onCreate={onCreate}
    />
  );
};

export default TreeArchive
