import { useState } from "react";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import { Card, ErrorText, GhostButton, PrimaryButton, TextField } from "../../components/ui/Primitives";
import type { AuthStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Signup">;

export default function SignupScreen({ navigation }: Props) {
  const { colors, fontSize } = useTheme();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSignUp = async () => {
    setError(null);
    if (!email.trim() || password.length < 6) {
      setError("Enter a valid email and a password with at least 6 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await signUp(email, password, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: "center", gap: 20 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.text, fontSize: fontSize.xxl, fontWeight: "900" }}>Create your account</Text>
        <Text style={{ color: colors.muted, fontSize: fontSize.base }}>Start tracking your job search with CareerOS.</Text>
      </View>

      <Card>
        <TextField label="Full name" value={name} onChangeText={setName} placeholder="Jordan Lee" />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 6 characters" />
        {error ? <ErrorText text={error} /> : null}
        <PrimaryButton label="Create Account" onPress={() => void handleSignUp()} loading={submitting} />
      </Card>

      <GhostButton label="Already have an account? Sign in" onPress={() => navigation.navigate("Login")} />
    </View>
  );
}
