import { canvas } from './renderer/canvas';
import { cameraSettings } from './renderer/camera';
import { renderer } from './renderer';
import { addMouseKeyboardEventListeners } from './controls/keyboard-controls';
import { showTouchControls } from './controls/touch-controls';

/**
 * XR fields we are using
 * Explained here : { https://github.com/immersive-web/webxr-reference/tree/master/webxr-device-api }
 * and here {https://immersive-web.github.io/webxr-reference/}
 */

export const XR = {
  session: null,
  immersiveRefSpace: null,
  nonImmersiveRefSpace: null,
  magicWindowCanvas: null,
  mirrorCanvas: null
};

/*
* Creates a button that renders each eye for VR
*/
function createVRButton() {
  const vrButton = document.createElement('button');
  vrButton.classList.add('vr-toggle');
  vrButton.textContent = 'Enter VR';
  vrButton.addEventListener('click', () => {
    if (XR.session) {
      XR.session.end();
    } else {
      xrOnRequestSession();
    }
  });
  document.body.appendChild(vrButton);
}

function xrOnSessionEnded(event) {
  XR.session = null;

  // Reset xrState when session ends and remove the mirror canvas
  if (event.session.mode === 'immersive-vr') {
    document.body.removeChild(document.getElementById('mirror-canvas'));
    xrValidateMagicWindow();
  } else {
    xrOnRequestSession();
  }
}

async function xrOnSessionStarted() {
  XR.session.addEventListener('end', xrOnSessionEnded);

  // Set rendering canvas to be XR compatible and add a baselayer
  try {
    await renderer.context.makeXRCompatible();
  } catch (err) {
    console.error(`Error making rendering context XR compatible : ${err}`);
  }

  // Set near and far settings for session camera
  XR.session.depthNear = cameraSettings.near;
  XR.session.depthFar = cameraSettings.far;

  /* global XRWebGLLayer:true */
  XR.session.updateRenderState({ baseLayer: new XRWebGLLayer(XR.session, renderer.context) });

  // With immersive and non immersive sessions we will be keeping track of
  // two reference spaces so we will hold two.
  try {
    const xrRefSpace = await XR.session.requestReferenceSpace({
      type: 'stationary',
      subtype: 'eye-level'
    });
    // Check if the session is immersive or non immersive and set the
    // respective refSpace.
    if (XR.session.mode === 'immersive-vr') {
      XR.immersiveRefSpace = xrRefSpace;
    } else {
      XR.nonImmersiveRefSpace = xrRefSpace;
    }

    // Fire a restart xr animation event
    window.dispatchEvent(new Event('xrAnimate'));
  } catch (err) {
    console.error(`Error requesting reference space : ${err}`);
  }
}

/**
 * Gets an immersive two eye view xr session when the 'ENTER XR' button has been pressed
 */
async function xrOnRequestSession() {
  // Create a mirror canvas for rendering the second eye
  const xrMirrorCanvas = document.createElement('canvas');
  const xrMirrorContext = xrMirrorCanvas.getContext('xrpresent');
  xrMirrorCanvas.setAttribute('id', 'mirror-canvas');

  // Add the mirror canvas to our XR object and the document.
  XR.mirrorCanvas = xrMirrorCanvas;
  document.body.appendChild(xrMirrorCanvas);

  // Attempt to create an XR session using the mirror canvas and the connected device
  try {
    XR.session = await navigator.xr.requestSession({ mode: 'immersive-vr', outputContext: xrMirrorContext });
    xrOnSessionStarted();
  } catch (err) {
    console.error(`Error initializing XR session : ${err}`);
  }
}

/**
 * Checks for magic window compatibility
 */
async function xrValidateMagicWindow() {
  // Ensure that there isn't already a magic window
  if (!XR.magicWindowCanvas) {
    XR.magicWindowCanvas = document.createElement('canvas');
    XR.magicWindowCanvas.setAttribute('id', 'vr-port');
    XR.magicWindowCanvas.setAttribute('name', 'magic-window');
    canvas.parentNode.insertBefore(XR.magicWindowCanvas, canvas);
  }
  XR.magicWindowCanvas.width = window.innerWidth;
  XR.magicWindowCanvas.height = window.innerHeight;

  // Set canvas rendering context to xrpresent
  const xrMagicWindowContext = XR.magicWindowCanvas.getContext('xrpresent');

  try {
    XR.session = await navigator.xr.requestSession({ outputContext: xrMagicWindowContext });
    canvas.style.display = 'none';
    xrOnSessionStarted();
  } catch (reason) {
    XR.magicWindowCanvas.style.display = 'none';
    console.log(`Device unable to support magic window session : ${reason}`);
  }
}

/*
 * Waits for an XR device to connect to the session and validates its capabilities
 */
async function xrValidate() {
  // TODO: Create new VRButton object here

  // Check that the browser has XR enabled
  if (navigator.xr) {
    // Listens for when a device changes and calls this function once again
    // to validate the new device / setup XR sessions
    navigator.xr.addEventListener('device-change', xrValidate);

    // Check if device is capable of an immersive-vr sessions
    try {
      await navigator.xr.supportsSessionMode('immersive-vr');
      // TODO: @author TimForsyth add the VR button creation here
      createVRButton();
      // TODO: Enable VR button here since immersive VR is available
    } catch (reason) {
      console.log(`Device unable to support immersive-vr session : ${reason || ''}`);
    }

    // Check to see if an non-immersive xr session is supported
    try {
      await navigator.xr.supportsSessionMode('inline');
      showTouchControls();
      xrValidateMagicWindow();
    } catch (reason) {
      console.log(`Device unable to support inline session : ${reason || ''}`);
      console.log('Instead, enable keyboard/mouse.');
      addMouseKeyboardEventListeners();
    }
  } else {
    addMouseKeyboardEventListeners();
  }
}

xrValidate();