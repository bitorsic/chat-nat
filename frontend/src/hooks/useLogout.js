import { useAuthContext } from "./useAuthContext";

export const useLogout = () => {
	const { dispatch } = useAuthContext();

	const logout = () => {
		// Dispatch logout action
		dispatch({type: 'LOGOUT'});
	};
	
	return { logout };
}