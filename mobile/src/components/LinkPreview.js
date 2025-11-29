import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { api } from "../services/api";

export default function LinkPreview({ url }) {
  const { colors } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchOGData();
  }, [url]);

  const fetchOGData = async () => {
    try {
      const response = await api.get(`/og?url=${encodeURIComponent(url)}`);
      if (response && (response.title || response.image)) {
        setData(response);
      } else {
        setError(true);
      }
    } catch (e) {
      console.log("OG fetch error:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePress = () => {
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url);
    }
  };

  if (loading || error || !data) return null;

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.glassBorder,
        },
      ]}
    >
      
      {data.image && (
        <Image
          source={{
            uri: data.image,
          }}
          style={styles.image}
          resizeMode="cover"
        />
      )}
      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            {
              color: colors.text,
            },
          ]}
          numberOfLines={2}
        >
          
          {data.title}
        </Text>
        {data.description && (
          <Text
            style={[
              styles.description,
              {
                color: colors.textSecondary,
              },
            ]}
            numberOfLines={2}
          >
            
            {data.description}
          </Text>
        )}
        <Text
          style={[
            styles.url,
            {
              color: colors.textTertiary,
            },
          ]}
          numberOfLines={1}
        >
          
          {data.siteName || new URL(url).hostname}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 8,
    maxWidth: 400,
  },
  image: {
    width: "100%",
    height: 150,
  },
  content: {
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    marginBottom: 8,
  },
  url: {
    fontSize: 10,
  },
});
