import React, {useContext} from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import Login from '../views/Login';
import {MainContext} from '../contexts/MainContext';
import {Icon} from '@rneui/themed';
import FeedPage from '../views/FeedPage';
import Profile from '../views/Profile';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const Tabscreen = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        activeTintColor: '#FF385C',
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedPage}
        options={{
          tabBarIcon: ({color}) => <Icon name="home" color={'#FF385C'}  />,
        }}
      />
      { <Tab.Screen
        name="Profile"
        component={Profile}
        options={{
          tabBarIcon: ({color}) => <Icon name="person" color={'#FF385C'} />,
        }}
      />/*
      <Tab.Screen
        name="Upload"
        component={Upload}
        options={{
          tabBarIcon: ({color}) => <Icon name="cloud-upload" color={color} />,
        }}
      /> */}
    </Tab.Navigator>
  );
};

const Stackscreen = () => {
  const {isLoggedIn} = useContext(MainContext);
  return (
    <Stack.Navigator>
      {isLoggedIn ? (
        <>
          <Stack.Screen
            name="Tabs"
            component={Tabscreen}
            options={{headerShown: false}}
          />
        </>
      ) : (
        <Stack.Screen name="Login" component={Login} />
      )}
    </Stack.Navigator>
  );
};

const Navigator = () => {
  return (
    <NavigationContainer>
      <Stackscreen />
    </NavigationContainer>
  );
};

export default Navigator;
