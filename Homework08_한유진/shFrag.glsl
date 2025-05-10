#version 300 es
precision highp float;

out vec4 FragColor;
in vec3 fragPos;
in vec3 normal;

struct Material {
    vec3 diffuse;     
    vec3 specular;
    float shininess;
};

struct Light {
    vec3 direction;
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

uniform Material material;
uniform Light light;
uniform vec3 u_viewPos;
uniform int u_toonLevel;

float quantize(float value, int toon) {
    float range = 1.0 / float(toon);     //해당 레벨의 범위 계산
    float num = floor(value/range);    //value가 속한 구간 판단, 하한값 사용
    return num / float(toon);            //(구간/레벨)->양자값
}

void main() {
    // ambient
    vec3 ambient = light.ambient * material.diffuse;

    // diffuse 
    vec3 norm = normalize(normal);
    vec3 lightDir = normalize(light.direction);
    float dotNormLight = dot(norm, lightDir);
    float diff = max(dotNormLight, 0.0);
    diff = quantize(diff, u_toonLevel);
    vec3 diffuse = light.diffuse * diff * material.diffuse;

    // specular
    vec3 viewDir = normalize(u_viewPos - fragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = 0.0;
    if (dotNormLight > 0.0){
        spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    }
    spec = quantize(spec, u_toonLevel);
    vec3 specular = light.specular * spec * material.specular;

    vec3 result = ambient + diffuse + specular;
    FragColor = vec4(result, 1.0);
}