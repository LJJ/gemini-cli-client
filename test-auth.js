import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:8080';

async function testAuth() {
  console.log('🧪 测试认证功能...\n');

  try {
    // 1. 测试认证状态
    console.log('1. 检查认证状态...');
    const statusResponse = await fetch(`${BASE_URL}/auth/status`);
    const statusData = await statusResponse.json();
    console.log('认证状态:', statusData);
    console.log('');

    // 2. 测试设置 Gemini API Key 认证
    console.log('2. 设置 Gemini API Key 认证...');
    const geminiResponse = await fetch(`${BASE_URL}/auth/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authType: 'gemini-api-key',
        apiKey: 'test-api-key-123'
      })
    });
    const geminiData = await geminiResponse.json();
    console.log('Gemini 认证结果:', geminiData);
    console.log('');

    // 3. 测试设置 Google 登录认证
    console.log('3. 设置 Google 登录认证...');
    const googleResponse = await fetch(`${BASE_URL}/auth/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authType: 'oauth-personal'
      })
    });
    const googleData = await googleResponse.json();
    console.log('Google 认证配置结果:', googleData);
    console.log('');

    // 4. 测试 Google 登录流程（会失败，但可以看到错误处理）
    console.log('4. 测试 Google 登录流程...');
    const loginResponse = await fetch(`${BASE_URL}/auth/google-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    const loginData = await loginResponse.json();
    console.log('Google 登录结果:', loginData);
    console.log('');

    // 5. 再次检查认证状态
    console.log('5. 再次检查认证状态...');
    const finalStatusResponse = await fetch(`${BASE_URL}/auth/status`);
    const finalStatusData = await finalStatusResponse.json();
    console.log('最终认证状态:', finalStatusData);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
testAuth(); 