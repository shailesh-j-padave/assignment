import React, { useState, useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Collaboration } from '@tiptap/extension-collaboration';
import axios from 'axios';
import _ from 'lodash';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import './Editor.css';

// Initialize Yjs document
const ydoc = new Y.Doc();
// Initialize WebSocket provider for Yjs
const provider = new WebsocketProvider('ws://localhost:1234', 'collaborative-editor', ydoc);

const Editor = () => {
  const [wordCount, setWordCount] = useState(0);
  const [version, setVersion] = useState(0);
  const [clientID] = useState(() => localStorage.getItem('clientID') || createClientID());

  const editor = useEditor({
    extensions: [
      StarterKit,
      Collaboration.configure({
        document: ydoc,  // Use the Yjs document directly
      }),
    ],
    onUpdate({ editor }) {
      const text = editor.getText();
      setWordCount(text.split(/\s+/).filter(word => word.length > 0).length);
    },
  });

  useEffect(() => {
    axios.get('http://localhost:4000/get-document').then(response => {
      editor?.commands.setContent(response.data.document);
      const text = editor?.getText() || "";
      setWordCount(text.split(/\s+/).filter(word => word.length > 0).length);
      setVersion(response.data.version);
    });
  }, [editor]);

  const debouncedSave = _.debounce(() => {
    const text = editor?.getText() || "";
    axios.post('http://localhost:4000/apply-step', {
      clientID: clientID,
      version: version + 1,
      stepData: text
    })
    .then(() => {
      setVersion(version + 1);
    })
    .catch((error) => {
      if (error.response && error.response.status === 409) {
        axios.get('http://localhost:4000/get-document').then(response => {
          editor?.commands.setContent(response.data.document);
          const text = editor?.getText() || "";
          setWordCount(text.split(/\s+/).filter(word => word.length > 0).length);
          setVersion(response.data.version);
          axios.post('http://localhost:4000/apply-step', {
            clientID: clientID,
            version: response.data.version + 1,
            stepData: text
          }).then(() => {
            setVersion(response.data.version + 1);
          });
        });
      }
    });
  }, 500);

  const handleSave = () => {
    debouncedSave();
  };

  return (
      <div className="editor-container">
        <EditorContent editor={editor} />
        <button onClick={handleSave}>Save</button>
        <p className="word-count">Word count: {wordCount}</p>
      </div>
  );
};

const createClientID = () => {
  const clientID = `client-${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('clientID', clientID);
  return clientID;
};

export default Editor;
