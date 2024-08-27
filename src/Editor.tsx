import React, {useEffect, useState} from 'react';
import {EditorContent, useEditor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {Collaboration} from '@tiptap/extension-collaboration';
import axios from 'axios';
import * as Y from 'yjs';
import {WebsocketProvider} from 'y-websocket';
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
    onUpdate({editor}) {
      const text = editor.getText();
      setWordCount(text.split(/\s+/).filter(word => word.length > 0).length);
    },
  });

  useEffect(() => {
    if (editor) {
      editor.commands.focus();  // Focus the editor when the page loads
    }
    axios.get('http://localhost:4000/get-document').then(response => {
      editor?.commands.setContent(response.data.document);
      const text = editor?.getText() || "";
      setWordCount(text.split(/\s+/).filter(word => word.length > 0).length);
      setVersion(response.data.version);
    });
  }, [editor]);

  const handleSave = () => {
    axios.get('http://localhost:4000/get-document')
    .then(response => {
      const serverDocument = response.data.document;
      const localDocument = editor?.getText() || "";

      // Only send the new content that hasn't been saved yet
      let newContent = "";
      if (localDocument.startsWith(serverDocument)) {
        newContent = localDocument.slice(serverDocument.length);
      } else {
        // Handle the case where there might be a discrepancy
        newContent = localDocument;
      }

      console.log("Newly Typed Content:", newContent);

      // Send the new content to the backend
      axios.post('http://localhost:4000/apply-step', {
        clientID: clientID,
        version: version + 1,
        stepData: newContent
      })
      .then(() => {
        setVersion(version + 1);
      })
      .catch((error) => {
        if (error.response && error.response.status === 409) {
          axios.get('http://localhost:4000/get-document').then(response => {
            editor?.commands.setContent(response.data.document);
            setVersion(response.data.version);
          });
        }
      });
    });
  };

  return (
      <div className="editor-container">
        <p className="word-count">Word count: {wordCount}</p>
        <EditorContent editor={editor}/>
        <button onClick={handleSave}>Save</button>
      </div>
  );
};

const createClientID = () => {
  const clientID = `client-${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('clientID', clientID);
  return clientID;
};

export default Editor;
