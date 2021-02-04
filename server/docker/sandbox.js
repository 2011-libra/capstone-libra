const Docker = require('dockerode');
const docker = new Docker();
const streams = require('memory-streams');
const path = require('path');
const tar = require('tar');

const removeStaleContainer = async token => {
  try {
    const staleContainer = docker.getContainer(`${token}-container`);
    await staleContainer.stop();
    await staleContainer.remove();
  } catch (error) {
    console.log('Error in removeStaleContainer:', error);
  }
};

const makeContainer = async token => {
  try {
    const container = await docker.createContainer({
      // Image: 'node:12-alpine',
      Image: 'node-libra',
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      Cmd: ['node', 'code'],
      name: `${token}-container`,
      HostConfig: {
        CapDrop: ['ALL']
      }
    });
    return container;
  } catch (error) {
    console.log('Error in createContainer:', error);

    if (error.statusCode === 409) {
      // Error: container already exists
      await removeStaleContainer(token);
    }
  }
};

const archiveCode = async token => {
  try {
    await tar.create(
      {
        cwd: path.join(__dirname, `/${token}`),
        file: path.join(__dirname, `/${token}/code.tar`)
      },
      ['code.js']
    );
  } catch (error) {
    console.log('Error in archiveCode:', error);
  }
};

const putCodeInContainer = async (container, token) => {
  try {
    await container.putArchive(path.join(__dirname, `/${token}/code.tar`), {
      path: '/'
    });
  } catch (error) {
    console.log('Error in putCodeInContainer:', error);
  }
};

const listenToContainer = async (container, stream) => {
  try {
    const attachedStream = await container.attach({
      stream: true,
      stdout: true,
      stderr: true
    });
    attachedStream.pipe(stream);
  } catch (error) {
    console.log('Error in listenToContainer:', error);
  }
};

const runContainer = async token => {
  const stdout = new streams.WritableStream();
  const container = await makeContainer(token);

  try {
    await archiveCode(token);
    await putCodeInContainer(container, token);
    await listenToContainer(container, stdout);
    await container.start();
  } catch (error) {
    console.log('Error in runContainer:', error);
  } finally {
    // Next line will automatically kill container in 10 sec.
    await container.stop();
    await container.remove();
  }

  return stdout.toString();
};

const trimControlCharacters = string => {
  let readableOutput = '';
  for (let i = 0; i < string.length; i++) {
    if (string.charCodeAt(i) > 31 || string.charCodeAt(i) === 10) {
      readableOutput += string[i];
    }
  }
  return readableOutput;
};

const run = async token => {
  try {
    const rawOutput = await runContainer(token);
    return trimControlCharacters(rawOutput);
  } catch (error) {
    console.log('Error in run:', error);
    return '[server error in running code]';
  }
};

module.exports = run;

// In this version, a new image is compiled every time.
// const makeImage = token => {
//   docker.buildImage(
//     {
//       context: path.join(__dirname, `/${token}`),
//       src: ['Dockerfile', `code.js`]
//     },
//     { t: `${token}-image` },
//     (err, response) => {
//       err ? console.log(err) : console.log('Image Built.');
//     }
//   );
// };
// const run = async token => {
//   try {
//     makeImage(token)
//     await runContainer(token);
//     const image = docker.getImage(`${token}-image`)
//     await image.remove()
//     console.log('DONE!');
//     console.log('stdout: ', stdout.toString());
//     return stdout.toString();
//   } catch (error) {
//     console.log(error);
//   }
// };

// const run = () => {
//   try {
//     runContainer().then(() => {
//       console.log('DONE!');
//       console.log('stdout: ', stdout.toString());
//       return stdout.toString();
//     });
//   } catch (error) {
//     console.log(error);
//   }
// };

// --------------------------------------------
// const makeImage = async () => {
//   await docker.buildImage(
//     {
//       context: path.join(__dirname, '/sample'),
//       src: ['Dockerfile', 'code.js']
//     },
//     { t: 'sample' },
//     (err, response) => {
//       err?
//       console.log(err):
//       console.log('Image Built.')
//     }
//   );

//   await docker.createContainer(
//     {
//       Image: 'sample',
//       AttachStdin: false,
//       AttachStdout: true,
//       AttachStderr: true,
//       Tty: true,
//       cmd: [],
//       name: 'sample-container'
//     },
//     function (err, container) {
//       err?
//       console.log(err):
//       console.log('Container Created.')
//     }
//   );

//   await docker.run(
//     'sample',
//     ['node', 'code'],
//     [stdout2, stderr2],
//     { Tty: false }
//   );

//   let [res, container] = await docker.run(
//     'sample',
//     ['node', 'code'],
//     [stdout, stderr],
//     { Tty: false }
//   );

//   await console.log('[sandbox.js] stdout: %j', stdout.toString());

//   let output = await stdout.toString();
//   // console.log('stderr: %j', stderr.toString())
//   await container.remove();
//   console.log('End of sandbox file.');
//   return output;
// };
