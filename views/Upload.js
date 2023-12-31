import {Input} from '@rneui/themed';
import {Controller, useForm} from 'react-hook-form';
import {Button} from '@rneui/base';
import {
  Alert,
  KeyboardAvoidingView,
  StyleSheet,
  View,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {useContext, useEffect, useState} from 'react';
import {appId, placeholderImage} from '../utils/app-config';
import {Video, Audio} from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useMedia, useTag} from '../hooks/ApiHooks';
import PropTypes from 'prop-types';
import {MainContext} from '../contexts/MainContext';
import * as DocumentPicker from 'expo-document-picker';
import * as MediaLibrary from 'expo-media-library';
import {TouchableOpacity} from 'react-native';
import {Icon, Text} from 'react-native-elements';
import {LinearGradient} from 'expo-linear-gradient';

const GradientButton = ({title, colors, onPress}) => (
  <TouchableOpacity onPress={onPress}>
    <LinearGradient colors={colors} style={styles.gradientButton}>
      <Text style={styles.buttonText}>{title}</Text>
    </LinearGradient>
  </TouchableOpacity>
);

const MediaPreview = ({type, source}) =>
  type === 'image' ? (
    <Image source={{uri: source}} style={styles.mediaPreview} />
  ) : (
    <Video
      source={{uri: source}}
      style={styles.mediaPreview}
      useNativeControls={true}
      resizeMode="cover"
      isLooping={true}
      shouldPlay={true}
    />
  );

const ControlBar = ({
  onPickImage,
  onCapture,
  onSelectAudio,
  onPlayAudio,
  audio,
  audioName,
  isPlaying,
}) => (
  <View style={styles.controlBarContainer}>
    <View style={styles.controlBar}>
      <TouchableOpacity onPress={onPickImage}>
        <Icon name="photo" size={40} color="white" />
        <Text style={styles.iconDescription}>Gallery</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onCapture}>
        <Icon name="camera-alt" size={40} color="white" />
        <Text style={styles.iconDescription}>Camera</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSelectAudio}>
        <Icon name="library-music" size={40} color="white" />
        <Text style={styles.iconDescription}>Audio</Text>
      </TouchableOpacity>
      {audio && (
        <TouchableOpacity onPress={onPlayAudio}>
          <Icon
            name={isPlaying ? 'pause' : 'play-arrow'}
            size={40}
            color="white"
          />
          <Text style={styles.iconDescription}>
            {isPlaying ? 'Pause' : 'Play'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
    {audioName && <Text style={styles.audioNameText}>{audioName}</Text>}
  </View>
);

const UploadForm = ({control, errors, onSubmit, onReset}) => (
  <View style={styles.uploadForm}>
    <Controller
      control={control}
      rules={{required: {value: true, message: 'is required'}}}
      render={({field: {onChange, onBlur, value}}) => (
        <Input
          placeholder="Title"
          onBlur={onBlur}
          onChangeText={onChange}
          value={value}
          inputStyle={{color: '#FFF'}}
          errorMessage={errors.title?.message}
        />
      )}
      name="title"
    />
    <Controller
      control={control}
      rules={{minLength: {value: 10, message: 'min 10 characters'}}}
      render={({field: {onChange, onBlur, value}}) => (
        <Input
          placeholder="Description (optional)"
          onBlur={onBlur}
          onChangeText={onChange}
          value={value}
          inputStyle={{color: '#FFF'}}
          errorMessage={errors.description?.message}
        />
      )}
      name="description"
    />
    <GradientButton
      title="Upload"
      colors={['#555', '#333']}
      onPress={onSubmit}
    />
    <GradientButton title="Reset" colors={['#555', '#333']} onPress={onReset} />
  </View>
);

const Upload = ({navigation}) => {
  const {update, setUpdate} = useContext(MainContext);
  const [image, setImage] = useState(placeholderImage);
  const [type, setType] = useState('image');
  const {postMedia, loading, putMedia} = useMedia();
  const {postTag} = useTag();
  const [audio, setAudio] = useState(null);
  const [audioPlayer, setAudioPlayer] = useState(null);
  const [audioName, setAudioName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const {
    control,
    reset,
    handleSubmit,
    formState: {errors},
  } = useForm({
    defaultValues: {
      title: '',
      description: '',
    },
    mode: 'onBlur',
  });

  const upload = async (uploadData) => {
    console.log('upload', uploadData);
    const token = await AsyncStorage.getItem('userToken');

    // 1. Upload the image/video first
    const formData = new FormData();
    formData.append('title', uploadData.title);
    formData.append('description', uploadData.description);
    const filename = image.split('/').pop();
    let fileExtension = filename.split('.').pop();
    fileExtension = fileExtension === 'jpg' ? 'jpeg' : fileExtension;
    formData.append('file', {
      uri: image,
      name: filename,
      type: `${type}/${fileExtension}`,
    });

    try {
      console.log('FormData', formData);
      const response = await postMedia(formData, token);
      console.log('lataus', response);

      // 2. If audio is selected, upload the audio
      let audioId = null;
      if (audio) {
        const audioFormData = new FormData();
        const audioFilename = audio.split('/').pop();
        const audioExtension = audioFilename.split('.').pop();
        audioFormData.append('file', {
          uri: audio,
          name: audioFilename,
          type: `audio/${audioExtension}`,
        });
        const audioResponse = await postMedia(audioFormData, token);
        audioId = audioResponse.file_id;
      }

      // 3. Update the image/video's description with the audio's file_id
      if (audioId) {
        const descriptionObject = {
          originalDescription: uploadData.description,
          audioId: audioId,
        };
        const updatedDescription = JSON.stringify(descriptionObject);

        // Update the image/video's description with `updatedDescription`.
        const token = await AsyncStorage.getItem('userToken');
        const updateResponse = await putMedia(response.file_id, token, {
          description: updatedDescription,
        });

        if (updateResponse.message === 'File info updated') {
          console.log('Description updated successfully');
        } else {
          console.error('Failed to update description');
        }
      }

      const tagResponse = await postTag(
        {
          file_id: response.file_id,
          tag: appId,
        },
        token,
      );
      console.log('Post tag: ', tagResponse);
      setUpdate(!update);

      if (audioPlayer) {
        await audioPlayer.stopAsync();
        await audioPlayer.unloadAsync();
        setAudioPlayer(null);
      }
      Alert.alert('Upload', response.message + 'Id: ' + response.file_id, [
        {
          text: 'Ok',
          onPress: () => {
            resetForm();
            navigation.navigate('Feed');
          },
        },
      ]);
    } catch (error) {
      console.log(error.message);
      // TODO notify user about failed
    }
  };

  const resetForm = () => {
    setImage(placeholderImage);
    setType('image');
    setAudio(null); // Reset the audio
    reset();
  };
  const captureFromCamera = async () => {
    const hasCameraAndRollPermission = await askCameraAndRollPermission();
    if (!hasCameraAndRollPermission) {
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      //allowsEditing: true,
      //aspect: [4, 3],
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setType(result.assets[0].type);
    }
  };
  const askCameraAndRollPermission = async () => {
    // Ask for camera permission
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraPermission.status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'You need to grant camera permissions to use this feature.',
      );
      return false;
    }

    // Ask for camera roll permission
    const cameraRollPermission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (cameraRollPermission.status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'You need to grant camera roll permissions to save the captured image/video.',
      );
      return false;
    }

    return true;
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      //allowsEditing: true,
      // aspect: [4, 3],
    });

    // purkka key cancelled in the image picker result is deprecated - warning
    //delete result.cancelled;
    //console.log(result);

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setType(result.assets[0].type);
    }
  };
  const selectAudio = async () => {
    console.log('selectAudio function called');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*', // Only allow audio files
      });
      console.log('DocumentPicker result:', JSON.stringify(result));
      if (result.type !== 'cancel' && result.assets && result.assets[0].uri) {
        setAudio(result.assets[0].uri);
        let audioFileName = result.assets[0].name;
        audioFileName = audioFileName.replace(/\.mp3$/i, ''); // Remove .mp3 extension if it exists
        setAudioName(audioFileName); // Set the audio name
        console.log('Audio URI set:', result.assets[0].uri);
        console.log('Audio name set:', audioFileName);
      }
    } catch (err) {
      console.error('Error picking audio:', err);
    }
  };
  const playAudio = async () => {
    console.log('playAudio function called');
    console.log('Trying to play audio from URI:', audio);
    if (audioPlayer) {
      await audioPlayer.unloadAsync();
      setAudioPlayer(null);
      setIsPlaying(false);
    } else {
      const newPlayer = new Audio.Sound();
      try {
        await newPlayer.loadAsync({uri: audio});
        setAudioPlayer(newPlayer);
        await newPlayer.playAsync();
        setIsPlaying(true); // Set the audio player state to playing
      } catch (error) {
        console.error('Error loading audio', error);
      }
    }
  };
  const askForFileSystemPermission = async () => {
    const {status} = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'You need to grant file system permissions to select an audio file.',
      );
      return false;
    }
    return true;
  };
  const handleSelectAudio = async () => {
    const hasPermission = await askForFileSystemPermission();
    if (hasPermission) {
      selectAudio();
    }
  };

  useEffect(() => {
    return () => {
      if (audioPlayer) {
        audioPlayer.unloadAsync();
      }
    };
  }, [audioPlayer]);
  useEffect(() => {
    const setupAudioMode = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          // interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_MIX_WITH_OTHERS,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          //  interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DUCK_OTHERS,
          playThroughEarpieceAndroid: false,
        });
      } catch (error) {
        console.error('Error setting audio mode:', error);
      }
    };

    setupAudioMode();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      // Screen is blurred, stop and unload the audio
      if (audioPlayer) {
        audioPlayer.stopAsync();
        audioPlayer.unloadAsync();
        setAudioPlayer(null);
      }
    });

    return unsubscribe;
  }, [navigation, audioPlayer]);
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 20}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={{color: '#FFF', marginTop: 10}}>Uploading...</Text>
        </View>
      ) : (
        <>
          <MediaPreview type={type} source={image} />
          <ControlBar
            onPickImage={pickImage}
            onCapture={captureFromCamera}
            onSelectAudio={selectAudio}
            onPlayAudio={playAudio}
            audio={audio}
            audioName={audioName}
            isPlaying={isPlaying}
          />
          <UploadForm
            control={control}
            errors={errors}
            onSubmit={handleSubmit(upload)}
            onReset={resetForm}
          />
        </>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mediaPreview: {
    flex: 1,
    resizeMode: 'cover',
  },
  controlBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '80%',
  },
  uploadForm: {
    padding: 16,
  },
  controlBarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  audioNameText: {
    color: 'white',
    marginTop: 10,
    fontSize: 16,
  },
  iconDescription: {
    color: 'white',
    textAlign: 'center',
    marginTop: 5,
  },
  gradientButton: {
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

Upload.propTypes = {
  navigation: PropTypes.shape({
    addListener: PropTypes.func.isRequired,
    navigate: PropTypes.func.isRequired,
    // Add other navigation methods/properties you're using, if any
  }).isRequired,
};

export default Upload;
