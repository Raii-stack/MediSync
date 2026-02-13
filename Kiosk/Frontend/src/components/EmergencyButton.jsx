import { Box, Button, Text } from '@chakra-ui/react';

export default function EmergencyButton({ onClick }) {
  return (
    <Box
      position="absolute"
      right="49px"
      top="33px"
      width="184px"
      height="60px"
    >
      <Button
        backgroundColor="#ef4444"
        bg="#ef4444"
        borderRadius="9999px"
        height="100%"
        width="100%"
        display="flex"
        alignItems="center"
        justifyContent="center"
        gap="2px"
        paddingX="20px"
        paddingY="12px"
        boxShadow="0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)"
        _hover={{ bg: '#dc2626' }}
        _active={{ bg: '#b91c1c' }}
        border="none"
        css={{ backgroundColor: '#ef4444 !important' }}
        style={{ backgroundColor: '#ef4444' }}
        onClick={onClick}
      >
        <Text 
          fontSize="32px" 
          color="white" 
          fontFamily="'Material Icons'" 
          lineHeight="28px"
          height="28px"
          width="18px"
        >
          warning
        </Text>
        <Text
          fontSize="16px"
          fontWeight="700"
          fontFamily="'Inter', sans-serif"
          color="white"
          textTransform="uppercase"
          letterSpacing="0.35px"
          lineHeight="20px"
          height="20px"
        >
          Emergency
        </Text>
      </Button>
    </Box>
  );
}
